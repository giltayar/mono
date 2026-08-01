import {expect, test, type Page} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {FIRST_USER} from '../services/fake-firebase-auth.ts'
import {createExpensesPageModel} from '../../page-model/expenses/expenses-page.model.ts'
import {createExpenseFormPageModel} from '../../page-model/expenses/expense-form-page.model.ts'

const {url, db, logIn} = setup(import.meta.url)

test.beforeEach(async ({page}) => {
  await logIn(page, FIRST_USER)
  // the app runs in UTC in the tests, so "now" for it is the same instant it is here
  page.on('dialog', (dialog) => dialog.accept())
})

test('shows an empty summary and no expenses to begin with', async ({page}) => {
  const expenses = createExpensesPageModel(page)

  await page.goto(url().href)

  await expect(expenses.heading().locator).toBeVisible()
  await expect(expenses.list().empty().locator).toBeVisible()
  await expect(expenses.summary().period('Day').current().locator).toHaveText('0.00')
  await expect(expenses.summary().period('Year').previous().locator).toHaveText('0.00')
})

test('adds an expense, and shows it in the list and in the totals', async ({page}) => {
  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)

  await page.goto(url().href)
  await expenses.addButton().locator.click()

  await expect(form.addHeading().locator).toBeVisible()

  await form.description().locator.fill('Coffee')
  await form.amount().locator.fill('12.50')
  await form.category('אוכל').locator.check()
  await form.submitButton().locator.click()

  await expect(page).toHaveURL(url().href)

  const item = expenses.list().item('Coffee')

  await expect(item.locator).toContainText('Coffee')
  await expect(item.locator).toContainText('אוכל')
  await expect(item.locator).toContainText('12.50')

  for (const period of ['Day', 'Week', 'Month', 'Year']) {
    await expect(expenses.summary().period(period).current().locator).toHaveText('12.50')
  }

  for (const period of ['Week', 'Month', 'Year']) {
    await expect(expenses.summary().period(period).current().dailyAverage().locator).toHaveText(
      '12.50 per day',
    )
    await expect(expenses.summary().period(period).previous().dailyAverage().locator).toContainText(
      'per day',
    )
  }
})

test('adds up several expenses', async ({page}) => {
  await addExpense(page, 'Coffee', '12.50', 'אוכל')
  await addExpense(page, 'Bus ticket', '6.00', 'תחבורה')

  const expenses = createExpensesPageModel(page)

  await expect(expenses.list().items().locator).toHaveCount(2)
  await expect(expenses.summary().period('Day').current().locator).toHaveText('18.50')
})

test('does not restart a period average after a gap in expenses', async ({page}) => {
  await seedExpense('Earlier expense', 1, noonOnTheFirstOfLastMonthUtc())
  await addExpense(page, 'Coffee', '12.50', 'אוכל')

  const expenses = createExpensesPageModel(page)
  const elapsedDaysInMonth = new Date().getUTCDate()

  await expect(expenses.summary().period('Month').current().dailyAverage().locator).toHaveText(
    `${(12.5 / elapsedDaysInMonth).toFixed(2)} per day`,
  )
})

test('shows the most recent expense first', async ({page}) => {
  await addExpense(page, 'Coffee', '12.50', 'אוכל')
  await addExpense(page, 'Bus ticket', '6.00', 'תחבורה')

  const expenses = createExpensesPageModel(page)

  await expect(expenses.list().items().locator).toContainText([/Bus ticket/, /Coffee/])
})

test('refuses an expense with no description, and keeps what was typed', async ({page}) => {
  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)

  await page.goto(url().href)
  await expenses.addButton().locator.click()

  await form.description().locator.fill('   ')
  await form.amount().locator.fill('12.50')
  await form.category('אוכל').locator.check()
  await form.submitButton().locator.click()

  await expect(form.error().locator).toHaveText('Please say what the expense was')
  await expect(form.amount().locator).toHaveValue('12.50')
  await expect(form.category('אוכל').locator).toBeChecked()
})

test('refuses an expense with no category even when the browser is bypassed', async ({page}) => {
  const expenses = createExpensesPageModel(page)

  const response = await page.request.post(new URL('/expenses', url()).href, {
    form: {description: 'Coffee', amount: '12.50', categoryId: ''},
  })

  expect(response.status()).toBe(400)
  expect(await response.text()).toContain('Please choose a category')

  await page.goto(url().href)

  await expect(expenses.list().empty().locator).toBeVisible()
})

test('refuses an amount that is not a number even when the browser is bypassed', async ({page}) => {
  const expenses = createExpensesPageModel(page)

  // `type=number` will not hold a non-number, which is exactly why the server checks too
  const response = await page.request.post(new URL('/expenses', url()).href, {
    form: {description: 'Coffee', amount: 'a lot', categoryId: '1'},
  })

  expect(response.status()).toBe(400)
  expect(await response.text()).toContain('Please enter an amount, like 12.50')

  await page.goto(url().href)

  await expect(expenses.list().empty().locator).toBeVisible()
})

test('goes back to the expenses without adding anything when cancelled', async ({page}) => {
  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)

  await page.goto(url().href)
  await expenses.addButton().locator.click()

  await form.description().locator.fill('Coffee')
  await form.cancelLink().locator.click()

  await expect(page).toHaveURL(url().href)
  await expect(expenses.list().empty().locator).toBeVisible()
})

test('edits an expense', async ({page}) => {
  await addExpense(page, 'Coffee', '12.50', 'אוכל')

  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)

  await expenses.list().item('Coffee').editLink().locator.click()

  await expect(form.editHeading().locator).toBeVisible()
  await expect(form.description().locator).toHaveValue('Coffee')
  await expect(form.amount().locator).toHaveValue('12.50')
  await expect(form.category('אוכל').locator).toBeChecked()

  await form.description().locator.fill('Espresso')
  await form.amount().locator.fill('8.00')
  await form.category('בידור').locator.check()
  await form.submitButton().locator.click()

  await expect(page).toHaveURL(url().href)
  await expect(expenses.list().items().locator).toHaveCount(1)

  const item = expenses.list().item('Espresso')

  await expect(item.locator).toContainText('בידור')
  await expect(item.locator).toContainText('8.00')
  await expect(expenses.summary().period('Day').current().locator).toHaveText('8.00')
})

test('deletes an expense, and takes it out of the totals', async ({page}) => {
  await addExpense(page, 'Coffee', '12.50', 'אוכל')
  await addExpense(page, 'Bus ticket', '6.00', 'תחבורה')

  const expenses = createExpensesPageModel(page)

  await expenses.list().item('Coffee').deleteButton().locator.click()

  await expect(expenses.list().items().locator).toHaveCount(1)
  await expect(expenses.list().item('Bus ticket').locator).toBeVisible()
  // the summary is swapped out of band by the same response
  await expect(expenses.summary().period('Day').current().locator).toHaveText('6.00')

  await page.goto(url().href)

  await expect(expenses.list().items().locator).toHaveCount(1)
})

test('counts an expense from yesterday in the previous day and not in today', async ({page}) => {
  await addExpense(page, 'Today', '1.00', 'אוכל')

  // seeded directly, because the app always timestamps an expense with the moment it was added
  await seedExpense('Yesterday', 2, noonYesterdayUtc())

  const expenses = createExpensesPageModel(page)

  await page.goto(url().href)

  await expect(expenses.summary().period('Day').current().locator).toHaveText('1.00')
  await expect(expenses.summary().period('Day').previous().locator).toHaveText('2.00')
})

test('leaves an expense from last month out of this month', async ({page}) => {
  await addExpense(page, 'Today', '1.00', 'אוכל')

  await seedExpense('Last month', 20, noonOnTheFirstOfLastMonthUtc())

  const expenses = createExpensesPageModel(page)

  await page.goto(url().href)

  await expect(expenses.list().items().locator).toHaveCount(1)
  await expect(expenses.list().item('Today').locator).toBeVisible()
  await expect(expenses.summary().period('Month').current().locator).toHaveText('1.00')
  await expect(expenses.summary().period('Month').previous().locator).toHaveText('20.00')
})

async function addExpense(page: Page, description: string, amount: string, category: string) {
  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)

  await page.goto(url().href)
  await expenses.addButton().locator.click()

  await form.description().locator.fill(description)
  await form.amount().locator.fill(amount)
  await form.category(category).locator.check()
  await form.submitButton().locator.click()

  await expect(page).toHaveURL(url().href)
}

async function seedExpense(description: string, amount: number, createdAt: Date) {
  await db()
    .insertInto('expense')
    .values({
      user_id: FIRST_USER.uid,
      description,
      amount,
      category_id: 1,
      created_at: createdAt.toISOString(),
    })
    .execute()
}

// the app runs the tests in UTC, so these are the instants it will put in the previous period
// whatever day the test happens to run on
function noonYesterdayUtc() {
  const now = new Date()

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 12, 0, 0))
}

function noonOnTheFirstOfLastMonthUtc() {
  const now = new Date()

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 12, 0, 0))
}
