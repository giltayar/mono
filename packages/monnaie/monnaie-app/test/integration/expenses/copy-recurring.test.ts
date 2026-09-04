import {expect, test} from '@playwright/test'
import {createCopyRecurringDialogPageModel} from '../../page-model/expenses/copy-recurring-dialog-page.model.ts'
import {createExpensesPageModel} from '../../page-model/expenses/expenses-page.model.ts'
import {setup} from '../common/setup.ts'
import {FIRST_USER, SECOND_USER} from '../services/fake-firebase-auth.ts'

const {url, db, logIn} = setup(import.meta.url)

test.beforeEach(async ({page}) => {
  await logIn(page, FIRST_USER)
})

test('loads the dialog on demand and copies selected recurring expenses', async ({page}) => {
  const previousMonth = monthDate(-1, 15)
  await seedExpense(FIRST_USER.uid, 'Coffee subscription', 'recurring', previousMonth)
  await seedExpense(FIRST_USER.uid, 'Rent', 'recurring', previousMonth)
  const ordinaryId = await seedExpense(FIRST_USER.uid, 'Groceries', 'day-to-day', previousMonth)
  const tooOldId = await seedExpense(
    FIRST_USER.uid,
    'Old subscription',
    'recurring',
    monthDate(-2, 15),
  )
  const otherUserId = await seedExpense(
    SECOND_USER.uid,
    'Other subscription',
    'recurring',
    previousMonth,
  )
  const expenses = createExpensesPageModel(page)
  const dialog = createCopyRecurringDialogPageModel(page)

  await page.goto(url().href)

  await expect(dialog.locator).toHaveCount(0)

  const addButtonBox = (await expenses.addButton().locator.boundingBox())!
  const copyButtonBox = (await expenses.copyRecurringButton().locator.boundingBox())!
  expect(copyButtonBox.y).toBe(addButtonBox.y)
  expect(copyButtonBox.width).toBeLessThan(addButtonBox.width)

  await expenses.copyRecurringButton().locator.click()

  await expect(dialog.locator).toBeVisible()
  await expect(dialog.expenses().locator).toHaveCount(2)
  await expect(dialog.expense('Coffee subscription').locator).not.toBeChecked()
  await expect(dialog.expense('Rent').locator).not.toBeChecked()
  await expect(dialog.date().locator).toHaveValue(today())

  await dialog.selectAll().locator.check()

  await expect(dialog.expense('Coffee subscription').locator).toBeChecked()
  await expect(dialog.expense('Rent').locator).toBeChecked()

  await dialog.selectAll().locator.uncheck()

  await expect(dialog.expense('Coffee subscription').locator).not.toBeChecked()
  await expect(dialog.expense('Rent').locator).not.toBeChecked()

  await dialog.cancelButton().locator.click()

  await expect(dialog.locator).toHaveCount(0)

  await expenses.copyRecurringButton().locator.click()
  await dialog.expense('Coffee subscription').locator.check()

  const targetDate = monthDate(0, 2).toISOString().slice(0, 10)
  await dialog.date().locator.fill(targetDate)

  // create malicious hidden inputs for expense IDs, and verify that they don't
  // break anything
  await dialog.locator.evaluate(
    (element, craftedIds) => {
      const form = element.querySelector('form')!

      for (const id of craftedIds) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = 'expenseId'
        input.value = String(id)
        form.append(input)
      }
    },
    [ordinaryId, tooOldId, otherUserId],
  )
  await dialog.copyButton().locator.click()

  await expect(page).toHaveURL(url().href)
  await expect(dialog.locator).toHaveCount(0)
  await expect(expenses.list().item('Coffee subscription').locator).toHaveCount(0)

  await page.goto(new URL('/?expenseType=recurring', url()).href)

  await expect(expenses.list().item('Coffee subscription').locator).toBeVisible()
  await expect(expenses.list().item('Coffee subscription').recurring().locator).toHaveText(
    'recurring',
  )

  const copied = await db()
    .selectFrom('expense')
    .select(['description', 'amount', 'category_id', 'expense_type', 'created_at'])
    .where('user_id', '=', FIRST_USER.uid)
    .where('created_at', '=', new Date(`${targetDate}T00:00:00.000Z`))
    .execute()

  expect(copied).toEqual([
    {
      description: 'Coffee subscription',
      amount: '12.50',
      category_id: 1,
      expense_type: 'recurring',
      created_at: new Date(`${targetDate}T00:00:00.000Z`),
    },
  ])
})

async function seedExpense(
  userId: string,
  description: string,
  expenseType: 'day-to-day' | 'special' | 'recurring',
  createdAt: Date,
): Promise<number> {
  const expense = await db()
    .insertInto('expense')
    .values({
      user_id: userId,
      description,
      amount: 12.5,
      category_id: 1,
      expense_type: expenseType,
      created_at: createdAt.toISOString(),
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  return expense.id
}

function monthDate(monthOffset: number, day: number): Date {
  const now = new Date()

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, day, 12))
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
