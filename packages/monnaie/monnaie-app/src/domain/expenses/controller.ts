import type {ControllerResult} from '../../commons/controller.ts'
import type {Db} from '../../commons/db.ts'
import {
  copyRecurringExpenses,
  DEFAULT_EXPENSE_TYPE_FILTER,
  deleteExpense,
  fetchCategoryTotals,
  fetchExpense,
  fetchExpenseTypeTotals,
  fetchPeriodExpenses,
  fetchPeriodTotals,
  saveExpense,
  updateExpense,
  validateExpense,
  type ExpenseInput,
  type ExpensesQuery,
  type ExpenseType,
} from './model.ts'
import {
  dateStringToTimestamp,
  monthDateStrings,
  periodDayCounts,
  periodNavigationDates,
  periodRanges,
  timestampToDateString,
} from './periods.ts'
import {
  renderExpenseSummary,
  renderExpensesMonth,
  renderExpensesPage,
  renderGraphsMonthForDate,
  renderGraphsPage,
} from './view/view.ts'
import {
  EMPTY_EXPENSE_FORM_VALUES,
  renderExpenseForm,
  renderExpenseFormPage,
  type ExpenseFormMode,
} from './view/expense-form-view.ts'
import {renderCopyRecurringDialog} from './view/copy-recurring-view.ts'

export async function showExpensesPage(
  db: Db,
  userId: string,
  timeZone: string,
  expenseQuery: ExpensesQuery,
  savedExpenseId: number,
  renderTarget: 'page' | 'expense-month',
): Promise<ControllerResult> {
  const {selectedDay} = expenseQuery
  const now = new Date()
  const referenceDate =
    selectedDay === undefined ? now : dateStringToTimestamp(selectedDay, timeZone)
  const currentDay = timestampToDateString(now, timeZone)
  const ranges = periodRanges(referenceDate, timeZone)
  const query = expenseQueryString(expenseQuery)

  if (renderTarget === 'expense-month') {
    const expenses = await fetchPeriodExpenses(db, userId, ranges.month, expenseQuery)

    return {
      html: renderExpensesMonth(expenses, timeZone, query, 0),
    }
  }

  const [summary, expenses] = await Promise.all([
    fetchPeriodTotals(db, userId, ranges, expenseQuery),
    fetchPeriodExpenses(db, userId, ranges.month, expenseQuery),
  ])

  return {
    html: renderExpensesPage(
      summary.totals,
      periodDayCounts(referenceDate, timeZone, summary.firstExpenseDate),
      expenses,
      timeZone,
      expenseQuery,
      query,
      referenceDate,
      currentDay,
      periodNavigationDates(referenceDate, now, timeZone),
      savedExpenseId,
    ),
  }
}

export async function showGraphsPage(
  db: Db,
  userId: string,
  timeZone: string,
  expenseQuery: ExpensesQuery,
  renderTarget: 'page' | 'expense-month',
): Promise<ControllerResult> {
  const {selectedDay} = expenseQuery
  const now = new Date()
  const referenceDate =
    selectedDay === undefined ? now : dateStringToTimestamp(selectedDay, timeZone)
  const currentDay = timestampToDateString(now, timeZone)
  const ranges = periodRanges(referenceDate, timeZone)
  const query = expenseQueryString(expenseQuery)

  if (renderTarget === 'expense-month') {
    const [summary, categoryTotals, expenseTypeTotals, expenses] = await Promise.all([
      fetchPeriodTotals(db, userId, ranges, expenseQuery),
      fetchCategoryTotals(db, userId, ranges.month, expenseQuery),
      fetchExpenseTypeTotals(db, userId, ranges.month, expenseQuery),
      fetchPeriodExpenses(db, userId, ranges.month, expenseQuery),
    ])

    return {
      html: renderGraphsMonthForDate(
        categoryTotals,
        expenseTypeTotals,
        dailyExpenseTotals(expenses, referenceDate, timeZone),
        periodDayCounts(referenceDate, timeZone, summary.firstExpenseDate).month,
        referenceDate,
        timeZone,
        query,
      ),
    }
  }

  const [summary, categoryTotals, expenseTypeTotals, expenses] = await Promise.all([
    fetchPeriodTotals(db, userId, ranges, expenseQuery),
    fetchCategoryTotals(db, userId, ranges.month, expenseQuery),
    fetchExpenseTypeTotals(db, userId, ranges.month, expenseQuery),
    fetchPeriodExpenses(db, userId, ranges.month, expenseQuery),
  ])

  return {
    html: renderGraphsPage(
      summary.totals,
      periodDayCounts(referenceDate, timeZone, summary.firstExpenseDate),
      categoryTotals,
      expenseTypeTotals,
      dailyExpenseTotals(expenses, referenceDate, timeZone),
      expenseQuery,
      query,
      referenceDate,
      timeZone,
      currentDay,
      periodNavigationDates(referenceDate, now, timeZone),
    ),
  }
}

function dailyExpenseTotals(
  expenses: Awaited<ReturnType<typeof fetchPeriodExpenses>>,
  referenceDate: Date,
  timeZone: string,
): number[] {
  const dates = monthDateStrings(referenceDate, timeZone)
  const totals = new Map(dates.map((date) => [date, 0]))

  for (const expense of expenses) {
    const date = timestampToDateString(expense.createdAt, timeZone)
    totals.set(date, (totals.get(date) ?? 0) + expense.amount)
  }

  return dates.map((date) => totals.get(date) ?? 0)
}

export function showNewExpensePage(expenseQuery: ExpensesQuery): ControllerResult {
  const query = expenseQueryString(expenseQuery)

  return {
    html: renderExpenseFormPage({
      mode: {kind: 'add'},
      query,
      values: EMPTY_EXPENSE_FORM_VALUES,
      error: undefined,
    }),
  }
}

export async function showCopyRecurringDialog(
  db: Db,
  userId: string,
  timeZone: string,
): Promise<ControllerResult> {
  const now = new Date()
  const expenses = await fetchPeriodExpenses(
    db,
    userId,
    periodRanges(now, timeZone).previousMonth,
    {categoryIds: [], expenseTypes: ['recurring'], title: ''},
  )

  return {html: renderCopyRecurringDialog(expenses)}
}

export async function copyRecurring(
  db: Db,
  userId: string,
  timeZone: string,
  expenseIds: number[],
): Promise<ControllerResult> {
  const now = new Date()

  await copyRecurringExpenses(
    db,
    userId,
    periodRanges(now, timeZone).previousMonth,
    expenseIds,
    now,
    timeZone,
  )

  return redirectToExpenses()
}

export async function addExpense(
  db: Db,
  userId: string,
  input: ExpenseInput,
  expenseQuery: ExpensesQuery,
): Promise<ControllerResult> {
  const query = expenseQueryString(expenseQuery)
  const result = validateExpense(input)

  if ('error' in result) {
    return {
      html: renderExpenseForm({
        mode: {kind: 'add'},
        query,
        values: input,
        error: result.error,
      }),
      statusCode: 400,
    }
  }

  const savedExpenseId = await saveExpense(db, userId, result.expense)

  const redirectQuery = new URLSearchParams(query)
  redirectQuery.set('savedExpense', String(savedExpenseId))

  return redirectToExpenses(`/?${redirectQuery}`)
}

export async function showEditExpensePage(
  db: Db,
  userId: string,
  id: number,
  timeZone: string,
  expenseQuery: ExpensesQuery,
): Promise<ControllerResult> {
  const expense = await fetchExpense(db, userId, id)
  const query = expenseQueryString(expenseQuery)

  if (expense === undefined) {
    return {
      html: renderExpenseFormPage({
        mode: {kind: 'add'},
        query,
        values: EMPTY_EXPENSE_FORM_VALUES,
        error: 'not-found',
      }),
      statusCode: 404,
    }
  }

  return {
    html: renderExpenseFormPage({
      mode: {kind: 'edit', id},
      query,
      values: {
        description: expense.description,
        amount: expense.amount.toFixed(2),
        categoryId: String(expense.categoryId),
        expenseType: expense.expenseType,
        date: timestampToDateString(expense.createdAt, timeZone),
      },
      error: undefined,
    }),
  }
}

export async function saveExpenseEdit(
  db: Db,
  userId: string,
  id: number,
  input: ExpenseInput,
  timeZone: string,
  expenseQuery: ExpensesQuery,
): Promise<ControllerResult> {
  const mode: ExpenseFormMode = {kind: 'edit', id}
  const query = expenseQueryString(expenseQuery)
  const result = validateExpense(input)

  if ('error' in result) {
    return {
      html: renderExpenseForm({
        mode,
        query,
        values: input,
        error: result.error,
      }),
      statusCode: 400,
    }
  }

  const createdAt = dateStringToTimestamp(result.expense.date!, timeZone)

  if (!(await updateExpense(db, userId, id, result.expense, createdAt))) {
    return {
      html: renderExpenseForm({
        mode,
        query,
        values: input,
        error: 'not-found',
      }),
      statusCode: 404,
    }
  }

  const redirectQuery = new URLSearchParams(query)
  redirectQuery.set('savedExpense', String(id))

  return redirectToExpenses(`/?${redirectQuery}`)
}

export async function removeExpense(
  db: Db,
  userId: string,
  id: number,
  timeZone: string,
  expenseQuery: ExpensesQuery,
): Promise<ControllerResult> {
  const {selectedDay} = expenseQuery
  await deleteExpense(db, userId, id)

  const now = new Date()
  const referenceDate =
    selectedDay === undefined ? now : dateStringToTimestamp(selectedDay, timeZone)
  const currentDay = timestampToDateString(now, timeZone)
  const ranges = periodRanges(referenceDate, timeZone)

  const summary = await fetchPeriodTotals(db, userId, ranges, expenseQuery)
  const query = expenseQueryString(expenseQuery)

  return {
    html: renderExpenseSummary(
      summary.totals,
      periodDayCounts(referenceDate, timeZone, summary.firstExpenseDate),
      {
        outOfBand: true,
        path: '/',
        referenceDate,
        timeZone,
        query,
        referenceDay: selectedDay ?? currentDay,
        currentDay,
        navigationDates: periodNavigationDates(referenceDate, now, timeZone),
      },
    ),
  }
}

/** The ids, never the names: an id is permanent, so a bookmarked filter keeps its meaning */
function expenseQueryString({
  categoryIds,
  expenseTypes,
  title,
  selectedDay,
}: ExpensesQuery): string {
  if (
    categoryIds.length === 0 &&
    isDefaultExpenseTypeFilter(expenseTypes) &&
    title === '' &&
    selectedDay === undefined
  ) {
    return ''
  }

  const query = new URLSearchParams(categoryIds.map((id) => ['category', String(id)]))

  if (!isDefaultExpenseTypeFilter(expenseTypes)) {
    for (const expenseType of expenseTypes) {
      query.append('expenseType', expenseType)
    }
  }

  if (title !== '') {
    query.set('title', title)
  }

  if (selectedDay !== undefined) {
    query.set('day', selectedDay)
  }

  return `?${query}`
}

function isDefaultExpenseTypeFilter(expenseTypes: ExpenseType[]): boolean {
  return (
    expenseTypes.length === DEFAULT_EXPENSE_TYPE_FILTER.length &&
    DEFAULT_EXPENSE_TYPE_FILTER.every((expenseType) => expenseTypes.includes(expenseType))
  )
}

/**
 * HTMX follows a `303` inside its own request, which would swap a whole page into a fragment, so a
 * successful save asks the browser to navigate instead.
 */
function redirectToExpenses(path = '/'): ControllerResult {
  return {html: '', headers: {'HX-Redirect': path}}
}
