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

test('groups this month by category and renders the pie', async ({page}) => {
  await saveExpense(db(), FIRST_USER.uid, {
    description: 'Coffee',
    amount: 10,
    categoryId: 1,
    date: undefined,
  })
  await saveExpense(db(), FIRST_USER.uid, {
    description: 'Lunch',
    amount: 2.5,
    categoryId: 1,
    date: undefined,
  })
  await saveExpense(db(), FIRST_USER.uid, {
    description: 'Bus',
    amount: 6,
    categoryId: 2,
    date: undefined,
  })
  await saveExpense(db(), SECOND_USER.uid, {
    description: 'Somebody else',
    amount: 100,
    categoryId: 2,
    date: undefined,
  })
  const expenses = createExpensesPageModel(page)

  await page.goto(graphUrl().href)

  const chartConfiguration = JSON.parse(
    (await expenses.graph().canvas().locator.getAttribute('data-chart-configuration'))!,
  )

  expect(chartConfiguration).toMatchObject({
    type: 'pie',
    data: {datasets: [{data: [12.5, 6]}]},
    options: {responsive: true, maintainAspectRatio: false},
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

function graphUrl(): URL {
  return new URL('/expenses/graphs', url())
}
