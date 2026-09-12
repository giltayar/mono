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
  await expect(expenses.summary().heading().locator).toHaveText('Summary: Today')
  await expect(expenses.list().empty().locator).toBeVisible()
  await expect(expenses.summary().period('Day').current().locator).toHaveText('0.00')
  await expect(expenses.summary().period('Year').previous().locator).toHaveText('0.00')

  for (const period of ['Day', 'Week', 'Month', 'Year']) {
    await expect(expenses.summary().period(period).forward().locator).toHaveCount(0)
  }
})

test('navigates summary periods around the selected day', async ({page}) => {
  await seedExpense('Selected day', 15, new Date('2024-03-15T12:00:00Z'))
  await seedExpense('Previous day', 14, new Date('2024-03-14T12:00:00Z'))
  const expenses = createExpensesPageModel(page)

  await gotoDayWithFoodFilter(page, '2024-03-15')

  await expect(expenses.summary().heading().locator).toHaveText('Summary: Friday, March 15, 2024')
  await expect(expenses.summary().period('Day').current().locator).toHaveText('15.00')
  await expect(expenses.summary().period('Day').previous().locator).toHaveText('14.00')
  const amountColumnGeometry = () =>
    Promise.all(
      [
        expenses.summary().period('Day').current().locator,
        expenses.summary().period('Day').previous().locator,
      ].map((locator) =>
        locator.evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          return {x: bounds.x, width: bounds.width}
        }),
      ),
    )
  const initialAmountColumnGeometry = await amountColumnGeometry()

  for (const {period, direction, expectedHeading} of [
    {period: 'Week', direction: 'backward', expectedHeading: 'Summary: Saturday, March 9, 2024'},
    {period: 'Week', direction: 'forward', expectedHeading: 'Summary: Saturday, March 23, 2024'},
    {
      period: 'Month',
      direction: 'backward',
      expectedHeading: 'Summary: Thursday, February 29, 2024',
    },
    {
      period: 'Year',
      direction: 'forward',
      expectedHeading: 'Summary: Wednesday, December 31, 2025',
    },
  ] as const) {
    await gotoDayWithFoodFilter(page, '2024-03-15')
    const navigation = expenses.summary().period(period)[direction]().locator

    await expect(navigation).toHaveAttribute(
      'hx-on:htmx:before-transition',
      new RegExp(`expenseDirection = '${direction}'`),
    )
    await navigation.click()

    await expect(expenses.summary().heading().locator).toHaveText(expectedHeading)
    await expect(expenses.filter().category('אוכל').locator).toBeChecked()
    expect(await amountColumnGeometry()).toEqual(initialAmountColumnGeometry)
  }

  await gotoDayWithFoodFilter(page, '2024-03-15')

  await expenses.summary().period('Day').backward().locator.click()

  await expect(page).toHaveURL(new URL('/?category=1&day=2024-03-14', url()).href)
  await expect(expenses.summary().period('Day').current().locator).toHaveText('14.00')

  await expenses.filter().category('אוכל').locator.uncheck()

  await expect(page).toHaveURL(new URL('/?day=2024-03-14', url()).href)
})

test('names every summary number for its calendar period (to support view transitions)', async ({
  page,
}) => {
  const expenses = createExpensesPageModel(page)

  await page.goto(new URL('/?day=2024-03-15', url()).href)

  for (const {period, currentStart, previousStart} of [
    {period: 'Day', currentStart: '2024-03-15', previousStart: '2024-03-14'},
    {period: 'Week', currentStart: '2024-03-10', previousStart: '2024-03-03'},
    {period: 'Month', currentStart: '2024-03-01', previousStart: '2024-02-01'},
    {period: 'Year', currentStart: '2024-01-01', previousStart: '2023-01-01'},
  ] as const) {
    const periodName = period.toLowerCase()
    const summaryPeriod = expenses.summary().period(period)

    await expect(summaryPeriod.current().locator).toHaveAttribute(
      'style',
      `view-transition-name: transition-${periodName}-${currentStart}`,
    )
    await expect(summaryPeriod.previous().locator).toHaveAttribute(
      'style',
      `view-transition-name: transition-${periodName}-${previousStart}`,
    )

    if (period !== 'Day') {
      await expect(summaryPeriod.current().dailyAverage().locator).toHaveAttribute(
        'style',
        `view-transition-name: transition-${periodName}-average-${currentStart}`,
      )
      await expect(summaryPeriod.previous().dailyAverage().locator).toHaveAttribute(
        'style',
        `view-transition-name: transition-${periodName}-average-${previousStart}`,
      )
    }
  }
})

test('gives expenses at midnight distinct view transition names', async ({page}) => {
  const createdAt = new Date('2024-03-15T00:00:00Z')
  await seedExpense('First expense', 1, createdAt)
  await seedExpense('Second expense', 2, createdAt)
  const expenses = createExpensesPageModel(page)

  await page.goto(new URL('/?day=2024-03-15', url()).href)

  const firstName = await expenses.list().item('First expense').locator.getAttribute('style')
  const secondName = await expenses.list().item('Second expense').locator.getAttribute('style')

  expect(firstName).toMatch(
    /^view-transition-name: expense-2024-03-15T00-00-00-000Z-[0-9a-f-]{36}$/,
  )
  expect(secondName).toMatch(
    /^view-transition-name: expense-2024-03-15T00-00-00-000Z-[0-9a-f-]{36}$/,
  )
  expect(firstName).not.toBe(secondName)
})

test('returns to today from either title and keeps the category filter', async ({page}) => {
  const expenses = createExpensesPageModel(page)

  for (const title of [expenses.heading().link(), expenses.summary().heading().link()]) {
    await gotoDayWithFoodFilter(page, '2024-03-15')
    await title.locator.click()

    await expect(expenses.summary().heading().locator).toHaveText('Summary: Today')
    await expect(expenses.filter().category('אוכל').locator).toBeChecked()
    await expect(page).toHaveURL((currentUrl) => !currentUrl.searchParams.has('day'))
  }
})

test('links forward from yesterday to today without a day query', async ({page}) => {
  const yesterday = noonYesterdayUtc().toISOString().slice(0, 10)
  const expenses = createExpensesPageModel(page)

  await gotoDayWithFoodFilter(page, yesterday)

  await expenses.summary().period('Day').forward().locator.click()

  await expect(expenses.summary().heading().locator).toHaveText('Summary: Today')
  await expect(expenses.filter().category('אוכל').locator).toBeChecked()
  await expect(page).toHaveURL((currentUrl) => !currentUrl.searchParams.has('day'))
})

test('adds an expense, and shows it in the list and in the totals', async ({page}) => {
  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)

  await page.goto(url().href)
  await expect(expenses.addButton().locator).toHaveAttribute(
    'style',
    'view-transition-name: add-expense',
  )
  await expenses.addButton().locator.click()

  await expect(form.addHeading().locator).toHaveAttribute(
    'style',
    'view-transition-name: add-expense',
  )
  await expect(form.fields().locator).toHaveAttribute(
    'style',
    'view-transition-name: saved-expense',
  )
  await expect(form.submitButton().locator).not.toHaveAttribute('style')

  await form.description().locator.fill('Coffee')
  await form.amount().locator.fill('12.50')
  await form.category('אוכל').locator.check()
  await form.submitButton().locator.click()

  await expect(page).toHaveURL(url().href)

  const savedExpense = await db()
    .selectFrom('expense')
    .select('expense_type')
    .where('description', '=', 'Coffee')
    .executeTakeFirstOrThrow()
  expect(savedExpense.expense_type).toBe('day-to-day')

  const item = expenses.list().item('Coffee')

  await expect(item.locator).toHaveAttribute('style', 'view-transition-name: saved-expense')
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

test('adds a special expense', async ({page}) => {
  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)

  await page.goto(new URL('/expenses/new', url()).href)
  await expect(form.expenseType('Day to day').locator).toBeChecked()

  await form.description().locator.fill('Refrigerator')
  await form.amount().locator.fill('1200')
  await form.category('אחר').locator.check()
  await form.expenseType('Special').locator.check()
  await form.submitButton().locator.click()

  await expect(page).toHaveURL(url().href)

  const savedExpense = await db()
    .selectFrom('expense')
    .select('expense_type')
    .where('description', '=', 'Refrigerator')
    .executeTakeFirstOrThrow()

  expect(savedExpense.expense_type).toBe('special')
  await expect(expenses.list().item('Refrigerator').special().locator).toHaveText('special')
})

test('keeps the filters after adding an expense', async ({page}) => {
  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)

  await page.goto(new URL('/?category=1&expenseType=special', url()).href)
  await expenses.addButton().locator.click()

  await expect(page).toHaveURL(new URL('/expenses/new?category=1&expenseType=special', url()).href)

  await form.description().locator.fill('Filtered expense')
  await form.amount().locator.fill('42')
  await form.category('אוכל').locator.check()
  await form.expenseType('Special').locator.check()
  await form.submitButton().locator.click()

  await expect(page).toHaveURL(new URL('/?category=1&expenseType=special', url()).href)
  await expect(expenses.filter().category('אוכל').locator).toBeChecked()
  await expect(expenses.filter().expenseType('Special').locator).toBeChecked()
  await expect(expenses.list().item('Filtered expense').locator).toBeVisible()
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
    form: {
      description: 'Coffee',
      amount: '12.50',
      categoryId: '',
      expenseType: 'day-to-day',
    },
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
    form: {
      description: 'Coffee',
      amount: 'a lot',
      categoryId: '1',
      expenseType: 'day-to-day',
    },
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
  const expense = await db()
    .selectFrom('expense')
    .select('id')
    .where('description', '=', 'Coffee')
    .executeTakeFirstOrThrow()

  await expect(expenses.list().item('Coffee').editLink().locator).toHaveAttribute(
    'style',
    `view-transition-name: edit-expense-${expense.id}`,
  )
  await expenses.list().item('Coffee').editLink().locator.click()

  await expect(form.editHeading().locator).toHaveAttribute(
    'style',
    `view-transition-name: edit-expense-${expense.id}`,
  )
  await expect(form.fields().locator).toHaveAttribute(
    'style',
    'view-transition-name: saved-expense',
  )
  await expect(form.description().locator).toHaveValue('Coffee')
  await expect(form.amount().locator).toHaveValue('12.50')
  await expect(form.category('אוכל').locator).toBeChecked()
  await expect(form.expenseType('Day to day').locator).toBeChecked()
  await expect(form.date().locator).toBeVisible()

  await form.description().locator.fill('Espresso')
  await form.amount().locator.fill('8.00')
  await form.category('בילוי').locator.check()
  await form.expenseType('Recurring').locator.check()
  await form.submitButton().locator.click()

  await expect(page).toHaveURL(url().href)
  await expect(expenses.list().items().locator).toHaveCount(0)

  await page.goto(new URL('/?expenseType=recurring', url()).href)

  await expect(expenses.list().items().locator).toHaveCount(1)

  const item = expenses.list().item('Espresso')

  await expect(item.locator).toContainText('בילוי')
  await expect(item.locator).toContainText('8.00')
  await expect(expenses.summary().period('Day').current().locator).toHaveText('8.00')

  const savedExpense = await db()
    .selectFrom('expense')
    .select('expense_type')
    .where('description', '=', 'Espresso')
    .executeTakeFirstOrThrow()
  expect(savedExpense.expense_type).toBe('recurring')
})

test('transitions an edited expense from the form back to its row', async ({page}) => {
  await addExpense(page, 'Coffee', '12.50', 'אוכל')

  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)

  await expenses.list().item('Coffee').editLink().locator.click()
  await form.amount().locator.fill('8.00')
  await form.submitButton().locator.click()

  await expect(expenses.list().item('Coffee').locator).toHaveAttribute(
    'style',
    'view-transition-name: saved-expense',
  )
  await expect(page).toHaveURL(url().href)
})

test('keeps all filters after editing an expense', async ({page}) => {
  await addExpense(page, 'Coffee', '12.50', 'אוכל')

  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)
  const today = new Date().toISOString().slice(0, 10)
  const filterPath = `/?category=1&expenseType=day-to-day&day=${today}`

  await page.goto(new URL(filterPath, url()).href)
  await expenses.list().item('Coffee').editLink().locator.click()

  await expect(page).toHaveURL(new URL(`/expenses/1/edit${filterPath.slice(1)}`, url()).href)

  await form.description().locator.fill('Espresso')
  await form.submitButton().locator.click()

  await expect(page).toHaveURL(new URL(filterPath, url()).href)
  await expect(expenses.filter().category('אוכל').locator).toBeChecked()
  await expect(expenses.filter().expenseType('Day to day').locator).toBeChecked()
  await expect(expenses.list().item('Espresso').locator).toBeVisible()
})

test('changes the date of an expense when editing', async ({page}) => {
  await addExpense(page, 'Coffee', '12.50', 'אוכל')

  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)

  await expenses.list().item('Coffee').editLink().locator.click()

  const yesterday = noonYesterdayUtc()
  const yesterdayString = yesterday.toISOString().slice(0, 10)

  await form.date().locator.fill(yesterdayString)
  await form.submitButton().locator.click()

  await expect(page).toHaveURL(url().href)
  // moved to yesterday, so it no longer counts in today's total
  await expect(expenses.summary().period('Day').current().locator).toHaveText('0.00')
  await expect(expenses.summary().period('Day').previous().locator).toHaveText('12.50')
})

test('does not show the date field when adding an expense', async ({page}) => {
  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)

  await page.goto(url().href)
  await expenses.addButton().locator.click()

  await expect(form.addHeading().locator).toBeVisible()
  await expect(form.date().locator).toBeHidden()
})

test('deletes an expense, and takes it out of the totals', async ({page}) => {
  await addExpense(page, 'Coffee', '12.50', 'אוכל')
  await addExpense(page, 'Bus ticket', '6.00', 'תחבורה')

  const expenses = createExpensesPageModel(page)
  const deleteButton = expenses.list().item('Coffee').deleteButton().locator

  await expect(deleteButton).toHaveAttribute('hx-target', 'closest li')
  await expect(deleteButton).toHaveAttribute('hx-swap', 'outerHTML swap:250ms')
  await deleteButton.click()

  await expect(expenses.list().items().locator).toHaveCount(1)
  await expect(expenses.list().item('Bus ticket').locator).toBeVisible()
  // the summary is swapped out of band by the same response
  await expect(expenses.summary().period('Day').current().locator).toHaveText('6.00')

  await page.goto(url().href)

  await expect(expenses.list().items().locator).toHaveCount(1)

  await expenses.list().item('Bus ticket').deleteButton().locator.click()

  await expect(expenses.list().empty().locator).toBeVisible()
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
      expense_type: 'day-to-day',
      created_at: createdAt.toISOString(),
    })
    .execute()
}

async function gotoDayWithFoodFilter(page: Page, day: string) {
  const expenses = createExpensesPageModel(page)

  await page.goto(new URL(`/?day=${day}`, url()).href)
  await expenses.filter().toggle().locator.click()
  await expenses.filter().category('אוכל').locator.check()
  await expect(page).toHaveURL((currentUrl) => currentUrl.searchParams.get('category') === '1')
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
