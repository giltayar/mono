import type {ControllerResult} from '../../commons/controller.ts'
import type {Db} from '../../commons/db.ts'
import {
  deleteExpense,
  fetchExpense,
  fetchPeriodExpenses,
  fetchPeriodTotals,
  saveExpense,
  updateExpense,
  validateExpense,
  type ExpenseInput,
} from './model.ts'
import {periodRanges} from './periods.ts'
import {renderExpenseList, renderExpenseSummary, renderExpensesPage} from './view/view.ts'
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
): Promise<ControllerResult> {
  // one set of ranges for both queries, so the totals and the list can never disagree about where
  // the month starts
  const ranges = periodRanges(new Date(), timeZone)

  const [totals, expenses] = await Promise.all([
    fetchPeriodTotals(db, userId, ranges),
    fetchPeriodExpenses(db, userId, ranges.month),
  ])

  return {html: renderExpensesPage(totals, expenses, timeZone)}
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
): Promise<ControllerResult> {
  const mode: ExpenseFormMode = {kind: 'edit', id}
  const result = validateExpense(input)

  if ('error' in result) {
    return {html: renderExpenseForm({mode, values: input, error: result.error}), statusCode: 400}
  }

  if (!(await updateExpense(db, userId, id, result.expense))) {
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

  const ranges = periodRanges(new Date(), timeZone)

  const [totals, expenses] = await Promise.all([
    fetchPeriodTotals(db, userId, ranges),
    fetchPeriodExpenses(db, userId, ranges.month),
  ])

  return {
    html:
      renderExpenseList(expenses, {outOfBand: false, timeZone}) +
      renderExpenseSummary(totals, {outOfBand: true}),
  }
}

/**
 * HTMX follows a `303` inside its own request, which would swap a whole page into a fragment, so a
 * successful save asks the browser to navigate instead.
 */
function redirectToExpenses(): ControllerResult {
  return {html: '', headers: {'HX-Redirect': '/'}}
}
