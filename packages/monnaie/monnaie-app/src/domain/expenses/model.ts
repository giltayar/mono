import type {ExpressionBuilder} from 'kysely'
import type {Database, Db} from '../../commons/db.ts'
import {isKnownCategoryId} from './categories.ts'
import type {PeriodName, PeriodRange, PeriodRanges} from './periods.ts'

/** Translated by the view layer, so that the model has no display text in it */
export type ExpenseError =
  'empty-description' | 'description-too-long' | 'invalid-amount' | 'invalid-category' | 'not-found'

/** An expense as the form sends it: every field is still a string, and none of it is trusted */
export type ExpenseInput = {description: string; amount: string; categoryId: string}

export type ValidExpense = {description: string; amount: number; categoryId: number}

export type Expense = {
  id: number
  description: string
  amount: number
  categoryId: number
  createdAt: Date
}

export type PeriodTotals = Record<PeriodName, number>

export const DESCRIPTION_MAX_LENGTH = 100

/** What `numeric(12, 2)` can hold */
const AMOUNT_MAX = 9_999_999_999.99

/** Digits, and at most two of them after a single decimal point */
const AMOUNT_REGEX = /^\d+(?:\.\d{1,2})?$/

export function validateExpense({
  description,
  amount,
  categoryId,
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

  return {
    expense: {
      description: trimmedDescription,
      amount: amountAsNumber,
      categoryId: categoryIdAsNumber,
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
): Promise<boolean> {
  const result = await db
    .updateTable('expense')
    .set({
      description: expense.description,
      amount: expense.amount,
      category_id: expense.categoryId,
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
): Promise<Expense[]> {
  const rows = await db
    .selectFrom('expense')
    .select(['id', 'description', 'amount', 'category_id', 'created_at'])
    .where('user_id', '=', userId)
    .where('created_at', '>=', range.from)
    .where('created_at', '<', range.to)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .execute()

  return rows.map(toExpense)
}

/**
 * All eight totals in one query, using aggregate filters, since they differ only in which rows they
 * count. The boundaries arrive already calculated, so there is no date arithmetic here.
 */
export async function fetchPeriodTotals(
  db: Db,
  userId: string,
  ranges: PeriodRanges,
): Promise<PeriodTotals> {
  const totals = await db
    .selectFrom('expense')
    .where('user_id', '=', userId)
    .select((eb) => [
      totalIn(eb, ranges.day).as('day'),
      totalIn(eb, ranges.week).as('week'),
      totalIn(eb, ranges.month).as('month'),
      totalIn(eb, ranges.year).as('year'),
      totalIn(eb, ranges.previousDay).as('previousDay'),
      totalIn(eb, ranges.previousWeek).as('previousWeek'),
      totalIn(eb, ranges.previousMonth).as('previousMonth'),
      totalIn(eb, ranges.previousYear).as('previousYear'),
    ])
    .executeTakeFirstOrThrow()

  return {
    day: toAmount(totals.day),
    week: toAmount(totals.week),
    month: toAmount(totals.month),
    year: toAmount(totals.year),
    previousDay: toAmount(totals.previousDay),
    previousWeek: toAmount(totals.previousWeek),
    previousMonth: toAmount(totals.previousMonth),
    previousYear: toAmount(totals.previousYear),
  }
}

function totalIn(eb: ExpressionBuilder<Database, 'expense'>, range: PeriodRange) {
  return eb.fn
    .sum<string | null>('amount')
    .filterWhere('created_at', '>=', range.from)
    .filterWhere('created_at', '<', range.to)
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
