import {expect, test} from '@playwright/test'
import {saveExpense} from '../../../src/domain/expenses/model.ts'
import {createExpensesPageModel} from '../../page-model/expenses/expenses-page.model.ts'
import {setup} from '../common/setup.ts'
import {FIRST_USER} from '../services/fake-firebase-auth.ts'

const {url, db, logIn} = setup(import.meta.url)

const FOOD = {id: 1, name: 'אוכל'}
const TRANSPORT = {id: 2, name: 'תחבורה'}

test.beforeEach(async ({page}) => {
  await logIn(page, FIRST_USER)
  page.on('dialog', (dialog) => dialog.accept())
})

test('shows everything, with the pills hidden, until a category is chosen', async ({page}) => {
  await seedExpenses()

  const expenses = createExpensesPageModel(page)

  await page.goto(url().href)

  await expect(expenses.filter().category(FOOD.name).locator).toBeHidden()

  await expenses.filter().toggle().locator.click()

  await expect(expenses.filter().category(FOOD.name).locator).not.toBeChecked()
  await expect(expenses.list().items().locator).toHaveCount(2)
  await expect(expenses.summary().period('Day').current().locator).toHaveText('18.50')
})

test('filters the list, the totals and the url by one category', async ({page}) => {
  await seedExpenses()

  const expenses = createExpensesPageModel(page)

  await page.goto(url().href)
  await expenses.filter().toggle().locator.click()
  await expenses.filter().category(FOOD.name).locator.check()

  await expect(page).toHaveURL(filterUrl('/', [FOOD.id]).href)
  await expect(expenses.list().items().locator).toHaveCount(1)
  await expect(expenses.list().item('Coffee').locator).toBeVisible()

  for (const period of ['Day', 'Week', 'Month', 'Year']) {
    await expect(expenses.summary().period(period).current().locator).toHaveText('12.50')
  }
})

test('adds a second category to the filter rather than replacing the first', async ({page}) => {
  await seedExpenses()

  const expenses = createExpensesPageModel(page)

  await page.goto(filterUrl('/', [FOOD.id]).href)
  await expenses.filter().category(TRANSPORT.name).locator.check()

  await expect(page).toHaveURL(filterUrl('/', [FOOD.id, TRANSPORT.id]).href)
  await expect(expenses.list().items().locator).toHaveCount(2)
  await expect(expenses.summary().period('Day').current().locator).toHaveText('18.50')
})

test('goes back to everything when the last category is unchecked', async ({page}) => {
  await seedExpenses()

  const expenses = createExpensesPageModel(page)

  await page.goto(filterUrl('/', [FOOD.id]).href)

  await expect(expenses.list().items().locator).toHaveCount(1)

  await expenses.filter().category(FOOD.name).locator.uncheck()

  await expect(page).toHaveURL(url().href)
  await expect(expenses.list().items().locator).toHaveCount(2)
  await expect(expenses.summary().period('Day').current().locator).toHaveText('18.50')
})

test('opens the pills already ticked when the url says so', async ({page}) => {
  await seedExpenses()

  const expenses = createExpensesPageModel(page)

  await page.goto(filterUrl('/', [TRANSPORT.id]).href)

  // the disclosure is open, so that a bookmarked filter is visible rather than merely in effect
  await expect(expenses.filter().category(TRANSPORT.name).locator).toBeChecked()
  await expect(expenses.filter().category(FOOD.name).locator).not.toBeChecked()
  await expect(expenses.list().item('Bus ticket').locator).toBeVisible()
  await expect(expenses.summary().period('Day').current().locator).toHaveText('6.00')
})

test('ignores a category in the url that is not a category', async ({page}) => {
  await seedExpenses()

  const expenses = createExpensesPageModel(page)

  await page.goto(new URL('/?category=nonsense', url()).href)

  await expect(expenses.list().items().locator).toHaveCount(2)
  await expect(expenses.summary().period('Day').current().locator).toHaveText('18.50')
})

test('cycles between all, non-recurring and recurring expenses', async ({page}) => {
  await seedExpenses()

  const expenses = createExpensesPageModel(page)

  await page.goto(url().href)
  await expenses.filter().toggle().locator.click()

  await expect(expenses.filter().recurring().locator).toHaveText('All expenses')

  await expenses.filter().recurring().locator.click()

  await expect(page).toHaveURL(new URL('/?recurring=exclude', url()).href)
  await expect(expenses.filter().recurring().locator).toHaveText('No recurring expenses')
  await expect(expenses.list().item('Bus ticket').locator).toBeVisible()
  await expect(expenses.list().items().locator).toHaveCount(1)
  await expect(expenses.summary().period('Day').current().locator).toHaveText('6.00')

  await expenses.filter().recurring().locator.click()

  await expect(page).toHaveURL(new URL('/?recurring=only', url()).href)
  await expect(expenses.filter().recurring().locator).toHaveText('Only recurring expenses')
  await expect(expenses.list().item('Coffee').locator).toBeVisible()
  await expect(expenses.list().items().locator).toHaveCount(1)
  await expect(expenses.summary().period('Day').current().locator).toHaveText('12.50')

  await expenses.tabs().graphs().locator.click()

  await expect(page).toHaveURL(new URL('/expenses/graphs?recurring=only', url()).href)
  await expect(expenses.graph().entries().locator).toHaveCount(1)
  await expect(expenses.graph().entry(FOOD.name).locator).toBeVisible()

  await expenses.filter().recurring().locator.click()

  await expect(page).toHaveURL(new URL('/expenses/graphs', url()).href)
  await expect(expenses.filter().recurring().locator).toHaveText('All expenses')
  await expect(expenses.graph().entries().locator).toHaveCount(2)
})

test('keeps the filter when switching to the graphs', async ({page}) => {
  await seedExpenses()

  const expenses = createExpensesPageModel(page)

  await page.goto(filterUrl('/', [FOOD.id]).href)
  await expenses.tabs().graphs().locator.click()

  await expect(page).toHaveURL(filterUrl('/expenses/graphs', [FOOD.id]).href)
  await expect(expenses.graph().entries().locator).toHaveCount(1)
  await expect(expenses.graph().entry(FOOD.name).locator).toBeVisible()
})

// the form is never re-swapped, so its `hx-get` still says `/` once the graphs tab has been clicked
test('stays on the graphs when a category is ticked there', async ({page}) => {
  await seedExpenses()

  const expenses = createExpensesPageModel(page)

  await page.goto(url().href)
  await expenses.tabs().graphs().locator.click()

  await expect(expenses.graph().entries().locator).toHaveCount(2)

  await expenses.filter().toggle().locator.click()
  await expenses.filter().category(FOOD.name).locator.check()

  await expect(page).toHaveURL(filterUrl('/expenses/graphs', [FOOD.id]).href)
  await expect(expenses.graph().entry(FOOD.name).locator).toBeVisible()
  await expect(expenses.graph().entries().locator).toHaveCount(1)
  await expect(expenses.summary().period('Day').current().locator).toHaveText('12.50')
})

test('keeps the filter when deleting an expense', async ({page}) => {
  await seedExpenses()
  await saveExpense(db(), FIRST_USER.uid, {
    description: 'Lunch',
    amount: 20,
    categoryId: FOOD.id,
    recurring: false,
    date: undefined,
  })

  const expenses = createExpensesPageModel(page)

  await page.goto(filterUrl('/', [FOOD.id]).href)
  await expenses.list().item('Lunch').deleteButton().locator.click()

  await expect(expenses.list().items().locator).toHaveCount(1)
  await expect(expenses.list().item('Coffee').locator).toBeVisible()
  // the out-of-band summary has to come back filtered too, or it would jump to the unfiltered total
  await expect(expenses.summary().period('Day').current().locator).toHaveText('12.50')
})

test('restores the previous filter when going back', async ({page}) => {
  await seedExpenses()

  const expenses = createExpensesPageModel(page)

  await page.goto(url().href)
  await expenses.filter().toggle().locator.click()
  await expenses.filter().category(FOOD.name).locator.check()

  await expect(page).toHaveURL(filterUrl('/', [FOOD.id]).href)

  await page.goBack()

  await expect(page).toHaveURL(url().href)
  await expect(expenses.list().items().locator).toHaveCount(2)
})

function filterUrl(path: string, categoryIds: number[]): URL {
  const target = new URL(path, url())

  for (const id of categoryIds) {
    target.searchParams.append('category', String(id))
  }

  return target
}

async function seedExpenses(): Promise<void> {
  await saveExpense(db(), FIRST_USER.uid, {
    description: 'Coffee',
    amount: 12.5,
    categoryId: FOOD.id,
    recurring: true,
    date: undefined,
  })
  await saveExpense(db(), FIRST_USER.uid, {
    description: 'Bus ticket',
    amount: 6,
    categoryId: TRANSPORT.id,
    recurring: false,
    date: undefined,
  })
}
