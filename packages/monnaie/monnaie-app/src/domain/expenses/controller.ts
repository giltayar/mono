import type {ControllerResult} from '../../commons/controller.ts'
import type {Db} from '../../commons/db.ts'
import {
  deleteExpense,
  fetchCategoryTotals,
  fetchExpense,
  fetchPeriodExpenses,
  fetchPeriodTotals,
  saveExpense,
  updateExpense,
  validateExpense,
  type ExpenseInput,
} from './model.ts'
import {
  dateStringToTimestamp,
  periodDayCounts,
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

export async function showExpensesPage(
  db: Db,
  userId: string,
  timeZone: string,
  renderTarget: 'page' | 'expense-month',
): Promise<ControllerResult> {
  const now = new Date()
  const ranges = periodRanges(now, timeZone)

  if (renderTarget === 'expense-month') {
    const expenses = await fetchPeriodExpenses(db, userId, ranges.month)

    return {html: renderExpensesMonth(expenses, timeZone)}
  }

  const [summary, expenses] = await Promise.all([
    fetchPeriodTotals(db, userId, ranges),
    fetchPeriodExpenses(db, userId, ranges.month),
  ])

  return {
    html: renderExpensesPage(
      summary.totals,
      periodDayCounts(now, timeZone, summary.firstExpenseDate),
      expenses,
      timeZone,
    ),
  }
}

export async function showGraphsPage(
  db: Db,
  userId: string,
  timeZone: string,
  renderTarget: 'page' | 'expense-month',
): Promise<ControllerResult> {
  const now = new Date()
  const ranges = periodRanges(now, timeZone)

  if (renderTarget === 'expense-month') {
    const categoryTotals = await fetchCategoryTotals(db, userId, ranges.month)

    return {html: renderGraphsMonth(categoryTotals)}
  }

  const [summary, categoryTotals] = await Promise.all([
    fetchPeriodTotals(db, userId, ranges),
    fetchCategoryTotals(db, userId, ranges.month),
  ])

  return {
    html: renderGraphsPage(
      summary.totals,
      periodDayCounts(now, timeZone, summary.firstExpenseDate),
      categoryTotals,
    ),
  }
}

export function showNewExpensePage(): ControllerResult {
  return {
    html: renderExpenseFormPage({
      mode: {kind: 'add'},
      values: EMPTY_EXPENSE_FORM_VALUES,
      error: undefined,
    }),
  }
}

export async function addExpense(
  db: Db,
  userId: string,
  input: ExpenseInput,
): Promise<ControllerResult> {
  const result = validateExpense(input)

  if ('error' in result) {
    return {
      html: renderExpenseForm({mode: {kind: 'add'}, values: input, error: result.error}),
      statusCode: 400,
    }
  }

  await saveExpense(db, userId, result.expense)

  return redirectToExpenses()
}

export async function showEditExpensePage(
  db: Db,
  userId: string,
  id: number,
  timeZone: string,
): Promise<ControllerResult> {
  const expense = await fetchExpense(db, userId, id)

  if (expense === undefined) {
    return {
      html: renderExpenseFormPage({
        mode: {kind: 'add'},
        values: EMPTY_EXPENSE_FORM_VALUES,
        error: 'not-found',
      }),
      statusCode: 404,
    }
  }

  return {
    html: renderExpenseFormPage({
      mode: {kind: 'edit', id},
      values: {
        description: expense.description,
        amount: expense.amount.toFixed(2),
        categoryId: String(expense.categoryId),
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
): Promise<ControllerResult> {
  const mode: ExpenseFormMode = {kind: 'edit', id}
  const result = validateExpense(input)

  if ('error' in result) {
    return {html: renderExpenseForm({mode, values: input, error: result.error}), statusCode: 400}
  }

  const createdAt = dateStringToTimestamp(result.expense.date!, timeZone)

  if (!(await updateExpense(db, userId, id, result.expense, createdAt))) {
    return {html: renderExpenseForm({mode, values: input, error: 'not-found'}), statusCode: 404}
  }

  return redirectToExpenses()
}

export async function removeExpense(
  db: Db,
  userId: string,
  id: number,
  timeZone: string,
): Promise<ControllerResult> {
  await deleteExpense(db, userId, id)

  const now = new Date()
  const ranges = periodRanges(now, timeZone)

  const [summary, expenses] = await Promise.all([
    fetchPeriodTotals(db, userId, ranges),
    fetchPeriodExpenses(db, userId, ranges.month),
  ])

  return {
    html:
      renderExpenseList(expenses, {outOfBand: false, timeZone}) +
      renderExpenseSummary(
        summary.totals,
        periodDayCounts(now, timeZone, summary.firstExpenseDate),
        {outOfBand: true},
      ),
  }
}

/**
 * HTMX follows a `303` inside its own request, which would swap a whole page into a fragment, so a
 * successful save asks the browser to navigate instead.
 */
function redirectToExpenses(): ControllerResult {
  return {html: '', headers: {'HX-Redirect': '/'}}
}
