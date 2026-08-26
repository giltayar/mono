import type {ExpressionBuilder} from 'kysely'
import type {Database, Db} from '../../commons/db.ts'
import {EXPENSE_CATEGORIES, isKnownCategoryId} from './categories.ts'
import type {PeriodName, PeriodRange, PeriodRanges} from './periods.ts'

/** Translated by the view layer, so that the model has no display text in it */
export type ExpenseError =
  | 'empty-description'
  | 'description-too-long'
  | 'invalid-amount'
  | 'invalid-category'
  | 'invalid-date'
  | 'not-found'

/** An expense as the form sends it: every field is still a string, and none of it is trusted */
export type ExpenseInput = {
  description: string
  amount: string
  categoryId: string
  date: string | undefined
}

export type ValidExpense = {
  description: string
  amount: number
  categoryId: number
  date: string | undefined
}

export type Expense = {
  id: number
  description: string
  amount: number
  categoryId: number
  createdAt: Date
}

export type PeriodTotals = Record<PeriodName, number>

export type PeriodSummary = {
  totals: PeriodTotals
  firstExpenseDate: Date
}

export type CategoryTotal = {
  categoryId: number
  total: number
}

export const DESCRIPTION_MAX_LENGTH = 100

/** What `numeric(12, 2)` can hold */
const AMOUNT_MAX = 9_999_999_999.99

/** Digits, and at most two of them after a single decimal point */
const AMOUNT_REGEX = /^\d+(?:\.\d{1,2})?$/

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * The category ids from the query string, which is a bookmark and therefore may say anything. An
 * unknown or malformed id is dropped rather than refused, and the result is in category order, so
 * that the same set of categories always produces the same array however the URL spelled it.
 */
export function parseCategoryFilter(input: string[]): number[] {
  const ids = new Set(
    input.map(Number).filter((id) => Number.isInteger(id) && isKnownCategoryId(id)),
  )

  return EXPENSE_CATEGORIES.map(({id}) => id).filter((id) => ids.has(id))
}

export function validateExpense({
  description,
  amount,
  categoryId,
  date,
}: ExpenseInput): {expense: ValidExpense} | {error: ExpenseError} {
  const trimmedDescription = description.trim()

  if (trimmedDescription === '') {
    return {error: 'empty-description'}
  }

  if (trimmedDescription.length > DESCRIPTION_MAX_LENGTH) {
    return {error: 'description-too-long'}
  }

  const trimmedAmount = amount.trim()

  if (!AMOUNT_REGEX.test(trimmedAmount)) {
    return {error: 'invalid-amount'}
  }

  const amountAsNumber = Number(trimmedAmount)

  if (amountAsNumber <= 0 || amountAsNumber > AMOUNT_MAX) {
    return {error: 'invalid-amount'}
  }

  const categoryIdAsNumber = Number(categoryId)

  if (!Number.isInteger(categoryIdAsNumber) || !isKnownCategoryId(categoryIdAsNumber)) {
    return {error: 'invalid-category'}
  }

  if (date !== undefined) {
    if (!DATE_REGEX.test(date) || !isValidDate(date)) {
      return {error: 'invalid-date'}
    }
  }

  return {
    expense: {
      description: trimmedDescription,
      amount: amountAsNumber,
      categoryId: categoryIdAsNumber,
      date,
    },
  }
}

export async function saveExpense(db: Db, userId: string, expense: ValidExpense): Promise<void> {
  await db
    .insertInto('expense')
    .values({
      user_id: userId,
      description: expense.description,
      amount: expense.amount,
      category_id: expense.categoryId,
    })
    .execute()
}

/** `false` when there is no such expense *of this user*, which is the same answer either way */
export async function updateExpense(
  db: Db,
  userId: string,
  id: number,
  expense: ValidExpense,
  createdAt: Date,
): Promise<boolean> {
  const result = await db
    .updateTable('expense')
    .set({
      description: expense.description,
      amount: expense.amount,
      category_id: expense.categoryId,
      created_at: createdAt.toISOString(),
    })
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst()

  return result.numUpdatedRows > 0n
}

export async function deleteExpense(db: Db, userId: string, id: number): Promise<void> {
  await db.deleteFrom('expense').where('id', '=', id).where('user_id', '=', userId).execute()
}

export async function fetchExpense(
  db: Db,
  userId: string,
  id: number,
): Promise<Expense | undefined> {
  const row = await db
    .selectFrom('expense')
    .select(['id', 'description', 'amount', 'category_id', 'created_at'])
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst()

  return row === undefined ? undefined : toExpense(row)
}

export async function fetchPeriodExpenses(
  db: Db,
  userId: string,
  range: PeriodRange,
  categoryIds: number[],
): Promise<Expense[]> {
  let query = db
    .selectFrom('expense')
    .select(['id', 'description', 'amount', 'category_id', 'created_at'])
    .where('user_id', '=', userId)
    .where('created_at', '>=', range.from)
    .where('created_at', '<', range.to)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')

  if (categoryIds.length > 0) {
    query = query.where('category_id', 'in', categoryIds)
  }

  const rows = await query.execute()

  return rows.map(toExpense)
}

export async function fetchCategoryTotals(
  db: Db,
  userId: string,
  range: PeriodRange,
  categoryIds: number[],
): Promise<CategoryTotal[]> {
  let query = db
    .selectFrom('expense')
    .select(['category_id', (eb) => eb.fn.sum<string>('amount').as('total')])
    .where('user_id', '=', userId)
    .where('created_at', '>=', range.from)
    .where('created_at', '<', range.to)
    .groupBy('category_id')

  if (categoryIds.length > 0) {
    query = query.where('category_id', 'in', categoryIds)
  }

  const rows = await query.execute()

  return rows
    .map(({category_id, total}) => ({categoryId: category_id, total: Number(total)}))
    .sort((left, right) => right.total - left.total || left.categoryId - right.categoryId)
}

/**
 * All eight totals in one query, using aggregate filters, since they differ only in which rows they
 * count. The boundaries arrive already calculated, so there is no date arithmetic here.
 */
export async function fetchPeriodTotals(
  db: Db,
  userId: string,
  ranges: PeriodRanges,
  categoryIds: number[],
): Promise<PeriodSummary> {
  const summary = await db
    .selectFrom('expense')
    .where('user_id', '=', userId)
    .select((eb) => [
      totalIn(eb, ranges.day, categoryIds).as('day'),
      totalIn(eb, ranges.week, categoryIds).as('week'),
      totalIn(eb, ranges.month, categoryIds).as('month'),
      totalIn(eb, ranges.year, categoryIds).as('year'),
      totalIn(eb, ranges.previousDay, categoryIds).as('previousDay'),
      totalIn(eb, ranges.previousWeek, categoryIds).as('previousWeek'),
      totalIn(eb, ranges.previousMonth, categoryIds).as('previousMonth'),
      totalIn(eb, ranges.previousYear, categoryIds).as('previousYear'),
      // deliberately not filtered by category: the daily averages are capped by when this user
      // started tracking at all, which a category filter must not appear to move
      eb.fn.min<Date | null>('created_at').as('firstExpenseDate'),
    ])
    .executeTakeFirstOrThrow()

  return {
    totals: {
      day: toAmount(summary.day),
      week: toAmount(summary.week),
      month: toAmount(summary.month),
      year: toAmount(summary.year),
      previousDay: toAmount(summary.previousDay),
      previousWeek: toAmount(summary.previousWeek),
      previousMonth: toAmount(summary.previousMonth),
      previousYear: toAmount(summary.previousYear),
    },
    firstExpenseDate: summary.firstExpenseDate ?? new Date(0),
  }
}

function totalIn(
  eb: ExpressionBuilder<Database, 'expense'>,
  range: PeriodRange,
  categoryIds: number[],
) {
  const total = eb.fn
    .sum<string | null>('amount')
    .filterWhere('created_at', '>=', range.from)
    .filterWhere('created_at', '<', range.to)

  return categoryIds.length === 0 ? total : total.filterWhere('category_id', 'in', categoryIds)
}

/** `sum` is `null` over no rows at all, and a string otherwise, since `numeric` stays exact */
function toAmount(total: string | null): number {
  return Number(total ?? 0)
}

function toExpense(row: {
  id: number
  description: string
  amount: string
  category_id: number
  created_at: Date
}): Expense {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    categoryId: row.category_id,
    createdAt: row.created_at,
  }
}

function isValidDate(dateString: string): boolean {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year!, month! - 1, day)
  return date.getFullYear() === year && date.getMonth() === month! - 1 && date.getDate() === day
}
