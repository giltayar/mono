import {expect, test} from '@playwright/test'
import {saveExpense} from '../../../src/domain/expenses/model.ts'
import {createExpensesPageModel} from '../../page-model/expenses/expenses-page.model.ts'
import {setup} from '../common/setup.ts'
import {FIRST_USER, SECOND_USER} from '../services/fake-firebase-auth.ts'

const {url, db, logIn} = setup(import.meta.url)

test.beforeEach(async ({page}) => {
  await logIn(page, FIRST_USER)
})

test('shows the empty graph at its direct URL', async ({page}) => {
  const expenses = createExpensesPageModel(page)

  await page.goto(graphUrl().href)

  await expect(page).toHaveURL(graphUrl().href)
  await expect(expenses.summary().period('Month').current().locator).toHaveText('0.00')
  await expect(expenses.tabs().graphs().locator).toHaveAttribute('aria-current', 'page')
  await expect(expenses.graph().empty().locator).toBeVisible()
})

for (const path of ['/', '/expenses/graphs']) {
  test(`returns only the monthly section from ${path} when htmx targets it`, async ({page}) => {
    const response = await page.request.get(new URL(path, url()).href, {
      headers: {'HX-Target': 'expense-month'},
    })
    const html = await response.text()

    expect(response.ok()).toBe(true)
    expect(html).toContain('id="expense-month"')
    expect(html).not.toContain('id="expense-summary"')
    expect(html).not.toContain('<!DOCTYPE html>')
  })
}

test('switches views with HTMX and browser history', async ({page}) => {
  await saveExpense(db(), FIRST_USER.uid, {
    description: 'Coffee',
    amount: 12.5,
    categoryId: 1,
    expenseType: 'day-to-day',
    date: undefined,
  })
  const expenses = createExpensesPageModel(page)

  await page.goto(url().href)
  await expenses.summary().locator.evaluate((summary) => summary.setAttribute('data-preserved', ''))
  await expenses.tabs().graphs().locator.click()

  await expect(page).toHaveURL(graphUrl().href)
  await expect(expenses.graph().canvas().locator).toBeVisible()
  await expect(expenses.summary().locator).toHaveAttribute('data-preserved', '')
  await expect(expenses.summary().period('Month').current().locator).toHaveText('12.50')

  await page.goBack()

  await expect(page).toHaveURL(url().href)
  await expect(expenses.list().item('Coffee').locator).toBeVisible()

  await page.goForward()

  await expect(page).toHaveURL(graphUrl().href)
  await expect(expenses.graph().canvas().locator).toBeVisible()
})

test('keeps the graph tab and persistent controls when navigating summary dates', async ({
  page,
}) => {
  const expenses = createExpensesPageModel(page)
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayString = yesterday.toISOString().slice(0, 10)

  await page.goto(url().href)
  await expenses.heading().locator.evaluate((heading) => heading.setAttribute('data-preserved', ''))
  await expenses.filter().locator.evaluate((filter) => filter.setAttribute('data-preserved', ''))
  await expenses.tabs().graphs().locator.click()

  // The summary was not part of the tab swap and still rendered its links for `/`.
  await expenses.summary().period('Day').backward().locator.click()

  await expect(page).toHaveURL((currentUrl) => {
    return (
      currentUrl.pathname === '/expenses/graphs' &&
      currentUrl.searchParams.get('day') === yesterdayString
    )
  })
  await expect(expenses.tabs().graphs().locator).toHaveAttribute('aria-current', 'page')
  await expect(expenses.heading().locator).toHaveAttribute('data-preserved', '')
  await expect(expenses.filter().locator).toHaveAttribute('data-preserved', '')

  await expenses.filter().toggle().locator.click()
  await expenses.filter().category('אוכל').locator.check()

  await expect(page).toHaveURL((currentUrl) => {
    return (
      currentUrl.pathname === '/expenses/graphs' &&
      currentUrl.searchParams.get('day') === yesterdayString &&
      currentUrl.searchParams.get('category') === '1'
    )
  })
})

test('groups this month by category and renders the doughnut', async ({page}) => {
  await saveExpense(db(), FIRST_USER.uid, {
    description: 'Coffee',
    amount: 10,
    categoryId: 1,
    expenseType: 'day-to-day',
    date: undefined,
  })
  await saveExpense(db(), FIRST_USER.uid, {
    description: 'Lunch',
    amount: 2.5,
    categoryId: 1,
    expenseType: 'day-to-day',
    date: undefined,
  })
  await saveExpense(db(), FIRST_USER.uid, {
    description: 'Bus',
    amount: 6,
    categoryId: 2,
    expenseType: 'day-to-day',
    date: undefined,
  })
  await saveExpense(db(), SECOND_USER.uid, {
    description: 'Somebody else',
    amount: 100,
    categoryId: 2,
    expenseType: 'day-to-day',
    date: undefined,
  })
  const expenses = createExpensesPageModel(page)

  await page.goto(graphUrl().href)

  const chartConfiguration = JSON.parse(
    (await expenses.graph().canvas().locator.getAttribute('data-chart-configuration'))!,
  )

  expect(chartConfiguration).toMatchObject({
    type: 'doughnut',
    data: {datasets: [{data: [12.5, 6]}]},
    options: {responsive: true, maintainAspectRatio: false, cutout: '56%'},
  })
  await expect(expenses.graph().entries().locator).toHaveCount(2)
  await expect(expenses.graph().entry('אוכל').locator).toContainText('12.50')
  await expect(expenses.graph().entry('אוכל').locator).toContainText('67.6%')
  await expect(expenses.graph().entry('תחבורה').locator).toContainText('6.00')
  await expect(expenses.graph().entry('תחבורה').locator).toContainText('32.4%')

  await expect
    .poll(() =>
      expenses
        .graph()
        .canvas()
        .locator.evaluate((canvas: HTMLCanvasElement) => {
          const context = canvas.getContext('2d')
          if (context === null) return false

          return context
            .getImageData(0, 0, canvas.width, canvas.height)
            .data.some((value) => value > 0)
        }),
    )
    .toBe(true)
})

test('graphs expense types without their filter and every day with a monthly average', async ({
  page,
}) => {
  await db()
    .insertInto('expense')
    .values([
      expenseRow(FIRST_USER.uid, 'Coffee', 10, 'day-to-day', '2024-02-01T12:00:00Z'),
      expenseRow(FIRST_USER.uid, 'Lunch', 5, 'day-to-day', '2024-02-03T12:00:00Z'),
      expenseRow(FIRST_USER.uid, 'Holiday', 20, 'special', '2024-02-03T12:00:00Z'),
      expenseRow(FIRST_USER.uid, 'Rent', 30, 'recurring', '2024-02-04T12:00:00Z'),
      expenseRow(SECOND_USER.uid, 'Somebody else', 100, 'recurring', '2024-02-04T12:00:00Z'),
    ])
    .execute()
  const expenses = createExpensesPageModel(page)

  await page.goto(new URL('/expenses/graphs?expenseType=day-to-day&day=2024-02-15', url()).href)

  await expect(expenses.graphs().locator.getByRole('heading', {level: 3})).toHaveText([
    'By day',
    'By category',
    'By expense type',
  ])

  const typeConfiguration = JSON.parse(
    (await expenses.expenseTypeGraph().canvas().locator.getAttribute('data-chart-configuration'))!,
  )
  expect(typeConfiguration).toMatchObject({
    type: 'doughnut',
    data: {
      labels: ['Day to day', 'Special', 'Recurring'],
      datasets: [{data: [15, 20, 30]}],
    },
  })

  const dailyConfiguration = JSON.parse(
    (await expenses.dailyGraph().canvas().locator.getAttribute('data-chart-configuration'))!,
  )
  expect(dailyConfiguration.data.labels).toHaveLength(29)
  expect(dailyConfiguration.data.labels).toEqual(
    Array.from({length: 29}, (_value, index) => String(index + 1)),
  )
  expect(dailyConfiguration.data.datasets[0]).toMatchObject({
    type: 'bar',
    data: [10, 0, 5, ...Array.from({length: 26}, () => 0)],
    backgroundColor: Array.from({length: 29}, (_value, index) =>
      [3, 4, 10, 11, 17, 18, 24, 25].includes(index + 1) ? '#9ac4c9' : '#548a9b',
    ),
  })
  expect(dailyConfiguration.data.datasets[1]).toMatchObject({
    type: 'line',
    data: Array.from({length: 29}, () => 1),
    borderDash: [5, 5],
  })

  const graphBounds = await expenses.graphs().locator.evaluate((graphs) => {
    const {left, right} = graphs.getBoundingClientRect()
    return {left, right, viewportWidth: document.documentElement.clientWidth}
  })
  expect(graphBounds.left).toBeGreaterThanOrEqual(0)
  expect(graphBounds.right).toBeLessThanOrEqual(graphBounds.viewportWidth)
})

function expenseRow(
  userId: string,
  description: string,
  amount: number,
  expenseType: 'day-to-day' | 'special' | 'recurring',
  createdAt: string,
) {
  return {
    user_id: userId,
    description,
    amount,
    category_id: 1,
    expense_type: expenseType,
    created_at: createdAt,
  }
}

function graphUrl(): URL {
  return new URL('/expenses/graphs', url())
}
