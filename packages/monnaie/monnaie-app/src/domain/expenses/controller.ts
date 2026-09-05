import type {ControllerResult} from '../../commons/controller.ts'
import type {Db} from '../../commons/db.ts'
import {
  copyRecurringExpenses,
  DEFAULT_EXPENSE_TYPE_FILTER,
  deleteExpense,
  fetchCategoryTotals,
  fetchExpense,
  fetchPeriodExpenses,
  fetchPeriodTotals,
  saveExpense,
  updateExpense,
  validateExpense,
  type ExpenseInput,
  type ExpenseType,
} from './model.ts'
import {
  dateStringToTimestamp,
  periodDayCounts,
  periodNavigationDates,
  periodRanges,
  timestampToDateString,
} from './periods.ts'
import {
  renderExpenseList,
  renderExpenseSummary,
  renderExpensesMonth,
  renderExpensesPage,
  renderGraphsMonth,
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
  categoryIds: number[],
  expenseTypes: ExpenseType[],
  selectedDay: string | undefined,
  renderTarget: 'page' | 'expense-month',
): Promise<ControllerResult> {
  const now = new Date()
  const referenceDate =
    selectedDay === undefined ? now : dateStringToTimestamp(selectedDay, timeZone)
  const currentDay = timestampToDateString(now, timeZone)
  const ranges = periodRanges(referenceDate, timeZone)
  const query = expenseQuery(categoryIds, expenseTypes, selectedDay)

  if (renderTarget === 'expense-month') {
    const expenses = await fetchPeriodExpenses(db, userId, ranges.month, categoryIds, expenseTypes)

    return {
      html: renderExpensesMonth(expenses, timeZone, query),
    }
  }

  const [summary, expenses] = await Promise.all([
    fetchPeriodTotals(db, userId, ranges, categoryIds, expenseTypes),
    fetchPeriodExpenses(db, userId, ranges.month, categoryIds, expenseTypes),
  ])

  return {
    html: renderExpensesPage(
      summary.totals,
      periodDayCounts(referenceDate, timeZone, summary.firstExpenseDate),
      expenses,
      timeZone,
      categoryIds,
      expenseTypes,
      query,
      referenceDate,
      selectedDay,
      currentDay,
      periodNavigationDates(referenceDate, now, timeZone),
    ),
  }
}

export async function showGraphsPage(
  db: Db,
  userId: string,
  timeZone: string,
  categoryIds: number[],
  expenseTypes: ExpenseType[],
  selectedDay: string | undefined,
  renderTarget: 'page' | 'expense-month',
): Promise<ControllerResult> {
  const now = new Date()
  const referenceDate =
    selectedDay === undefined ? now : dateStringToTimestamp(selectedDay, timeZone)
  const currentDay = timestampToDateString(now, timeZone)
  const ranges = periodRanges(referenceDate, timeZone)
  const query = expenseQuery(categoryIds, expenseTypes, selectedDay)

  if (renderTarget === 'expense-month') {
    const categoryTotals = await fetchCategoryTotals(
      db,
      userId,
      ranges.month,
      categoryIds,
      expenseTypes,
    )

    return {
      html: renderGraphsMonth(categoryTotals, query),
    }
  }

  const [summary, categoryTotals] = await Promise.all([
    fetchPeriodTotals(db, userId, ranges, categoryIds, expenseTypes),
    fetchCategoryTotals(db, userId, ranges.month, categoryIds, expenseTypes),
  ])

  return {
    html: renderGraphsPage(
      summary.totals,
      periodDayCounts(referenceDate, timeZone, summary.firstExpenseDate),
      categoryTotals,
      categoryIds,
      expenseTypes,
      query,
      referenceDate,
      timeZone,
      selectedDay,
      currentDay,
      periodNavigationDates(referenceDate, now, timeZone),
    ),
  }
}

export function showNewExpensePage(
  categoryIds: number[],
  expenseTypes: ExpenseType[],
  selectedDay: string | undefined,
): ControllerResult {
  const query = expenseQuery(categoryIds, expenseTypes, selectedDay)

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
    [],
    ['recurring'],
  )

  return {html: renderCopyRecurringDialog(expenses, timestampToDateString(now, timeZone))}
}

export async function copyRecurring(
  db: Db,
  userId: string,
  timeZone: string,
  expenseIds: number[],
  date: string,
): Promise<ControllerResult> {
  const now = new Date()

  await copyRecurringExpenses(
    db,
    userId,
    periodRanges(now, timeZone).previousMonth,
    expenseIds,
    dateStringToTimestamp(date, timeZone),
  )

  return redirectToExpenses()
}

export async function addExpense(
  db: Db,
  userId: string,
  input: ExpenseInput,
  categoryIds: number[],
  expenseTypes: ExpenseType[],
  selectedDay: string | undefined,
): Promise<ControllerResult> {
  const query = expenseQuery(categoryIds, expenseTypes, selectedDay)
  const result = validateExpense(input)

  if ('error' in result) {
    return {
      html: renderExpenseForm({mode: {kind: 'add'}, query, values: input, error: result.error}),
      statusCode: 400,
    }
  }

  await saveExpense(db, userId, result.expense)

  return redirectToExpenses(`/${query}`)
}

export async function showEditExpensePage(
  db: Db,
  userId: string,
  id: number,
  timeZone: string,
  categoryIds: number[],
  expenseTypes: ExpenseType[],
  selectedDay: string | undefined,
): Promise<ControllerResult> {
  const expense = await fetchExpense(db, userId, id)
  const query = expenseQuery(categoryIds, expenseTypes, selectedDay)

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
  categoryIds: number[],
  expenseTypes: ExpenseType[],
  selectedDay: string | undefined,
): Promise<ControllerResult> {
  const mode: ExpenseFormMode = {kind: 'edit', id}
  const query = expenseQuery(categoryIds, expenseTypes, selectedDay)
  const result = validateExpense(input)

  if ('error' in result) {
    return {
      html: renderExpenseForm({mode, query, values: input, error: result.error}),
      statusCode: 400,
    }
  }

  const createdAt = dateStringToTimestamp(result.expense.date!, timeZone)

  if (!(await updateExpense(db, userId, id, result.expense, createdAt))) {
    return {
      html: renderExpenseForm({mode, query, values: input, error: 'not-found'}),
      statusCode: 404,
    }
  }

  return redirectToExpenses(`/${query}`)
}

export async function removeExpense(
  db: Db,
  userId: string,
  id: number,
  timeZone: string,
  categoryIds: number[],
  expenseTypes: ExpenseType[],
  selectedDay: string | undefined,
): Promise<ControllerResult> {
  await deleteExpense(db, userId, id)

  const now = new Date()
  const referenceDate =
    selectedDay === undefined ? now : dateStringToTimestamp(selectedDay, timeZone)
  const currentDay = timestampToDateString(now, timeZone)
  const ranges = periodRanges(referenceDate, timeZone)

  const [summary, expenses] = await Promise.all([
    fetchPeriodTotals(db, userId, ranges, categoryIds, expenseTypes),
    fetchPeriodExpenses(db, userId, ranges.month, categoryIds, expenseTypes),
  ])
  const query = expenseQuery(categoryIds, expenseTypes, selectedDay)

  return {
    html:
      renderExpenseList(expenses, {
        outOfBand: false,
        timeZone,
        query,
      }) +
      renderExpenseSummary(
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
function expenseQuery(
  categoryIds: number[],
  expenseTypes: ExpenseType[],
  selectedDay: string | undefined,
): string {
  if (
    categoryIds.length === 0 &&
    isDefaultExpenseTypeFilter(expenseTypes) &&
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
