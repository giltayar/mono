import {test, expect} from '@playwright/test'
import {createSalesEventListPageModel} from '../page-model/sales-events/sales-event-list-page.model.ts'
import {setup} from '../common/setup.ts'
import {TEST_seedSalesEvents} from '../../../src/domain/sales-event/model.ts'
import {createUpdateSalesEventPageModel} from '../page-model/sales-events/update-sales-event-page.model.ts'
import {TEST_seedProducts} from '../../../src/domain/product/model.ts'

const {url, sql} = setup(import.meta.url)

test('searching sales events', async ({page}) => {
  test.slow()

  await Promise.all([TEST_seedSalesEvents(sql(), 200, 200), TEST_seedProducts(sql(), 200)])

  await page.goto(new URL('/sales-events', url()).href)

  const salesEventListModel = createSalesEventListPageModel(page)
  const updateSalesEventModel = createUpdateSalesEventPageModel(page)

  await expect(salesEventListModel.list().rows().locator).toHaveCount(50)

  await expect(salesEventListModel.list().rows().row(0).idLink().locator).toHaveText('1')
  await expect(salesEventListModel.list().rows().row(0).nameCell().locator).toContainText(
    'wunruk lihcug',
  )
  await expect(salesEventListModel.list().rows().row(0).productsCell().locator).toContainText(
    'peg pavutko, hidwag wo',
  )

  // test infinite scroll

  await salesEventListModel.list().rows().row(49).locator.scrollIntoViewIfNeeded()
  await expect(salesEventListModel.list().rows().locator).toHaveCount(100)

  await salesEventListModel.list().rows().row(99).locator.scrollIntoViewIfNeeded()
  await expect(salesEventListModel.list().rows().locator).toHaveCount(150)

  await salesEventListModel.list().rows().row(149).locator.scrollIntoViewIfNeeded()
  await expect(salesEventListModel.list().rows().locator).toHaveCount(200)

  await salesEventListModel.list().rows().row(180).locator.scrollIntoViewIfNeeded()
  await expect(salesEventListModel.list().rows().locator).toHaveCount(200)

  // test search by name
  // NOTE: These values are hallucinated - update with actual seeded data when running tests

  await salesEventListModel.search().queryInput().locator.fill('wu')

  expect(salesEventListModel.list().rows().locator).toHaveCount(14)
  await expect(salesEventListModel.list().rows().row(0).nameCell().locator).toHaveText(
    'wunruk lihcug',
  )
  await expect(salesEventListModel.list().rows().row(4).productsCell().locator).toHaveText(
    'evlor jizezas, ozuzecek fimneopi',
  )

  // test search by landing page url
  // NOTE: These values are hallucinated - update with actual seeded data

  await salesEventListModel.search().queryInput().locator.fill('hepopwew')
  expect(salesEventListModel.list().rows().locator).toHaveCount(1)
  await expect(salesEventListModel.list().rows().row(0).nameCell().locator).toHaveText(
    'mapuuka sacwus',
  )

  // test search by date
  // NOTE: These values are hallucinated - update with actual seeded data

  await salesEventListModel.search().queryInput().locator.fill('2118')

  expect(salesEventListModel.list().rows().locator).toHaveCount(7)
  await expect(salesEventListModel.list().rows().row(3).nameCell().locator).toHaveText('jiv me')

  // test archived sales events

  await salesEventListModel.search().queryInput().locator.fill('')

  await salesEventListModel.list().rows().row(0).idLink().locator.click()

  await updateSalesEventModel.form().deleteButton().locator.click()
  await expect(updateSalesEventModel.form().restoreButton().locator).toBeVisible()

  await page.goto(new URL('/sales-events', url()).href)

  await salesEventListModel.search().queryInput().locator.fill('w')
  await expect(salesEventListModel.list().rows().locator).toHaveCount(50)
  await expect(salesEventListModel.list().rows().row(0).idLink().locator).toHaveText('2')

  await salesEventListModel.search().showArchivedCheckbox().locator.check()
  await expect(salesEventListModel.list().rows().row(0).idLink().locator).toHaveText('1')
  await expect(salesEventListModel.list().rows().locator).toHaveCount(50)

  await salesEventListModel.list().rows().row(49).locator.scrollIntoViewIfNeeded()
  await expect(salesEventListModel.list().rows().locator).toHaveCount(93)
})
