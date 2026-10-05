import {test, expect} from '@playwright/test'
import {createSalesEventListPageModel} from '../../page-model/sales-events/sales-event-list-page.model.ts'
import {setup} from '../common/setup.ts'
import {createSalesEvent, type NewSalesEvent} from '../../../src/domain/sales-event/model/model.ts'
import {createUpdateSalesEventPageModel} from '../../page-model/sales-events/update-sales-event-page.model.ts'
import {createUpdateProductPageModel} from '../../page-model/products/update-product-page.model.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import type {Sql} from 'postgres'

const {url, sql} = setup(import.meta.url)

test('searching sales events', async ({page}) => {
  test.slow()

  const {notableNumbers} = await seedSalesEvents(sql())

  await page.goto(new URL('/sales-events', url()).href)

  const salesEventListModel = createSalesEventListPageModel(page)
  const updateSalesEventModel = createUpdateSalesEventPageModel(page)

  // --- Pagination: first page loads 50 (descending order) ---
  await expect(salesEventListModel.list().rows().locator).toHaveCount(50)

  // First row = last-created filler (Event-194, sales event 200)
  await expect(salesEventListModel.list().rows().row(0).idLink().locator).toHaveText('200')
  await expect(salesEventListModel.list().rows().row(0).nameCell().locator).toHaveText('Event-194')

  // --- Infinite scroll ---
  await salesEventListModel.list().rows().row(49).locator.scrollIntoViewIfNeeded()
  await expect(salesEventListModel.list().rows().locator).toHaveCount(100)

  await salesEventListModel.list().rows().row(99).locator.scrollIntoViewIfNeeded()
  await expect(salesEventListModel.list().rows().locator).toHaveCount(150)

  await salesEventListModel.list().rows().row(149).locator.scrollIntoViewIfNeeded()
  await expect(salesEventListModel.list().rows().locator).toHaveCount(200)

  // Scrolling past the end doesn't create more rows
  await salesEventListModel.list().rows().row(180).locator.scrollIntoViewIfNeeded()
  await expect(salesEventListModel.list().rows().locator).toHaveCount(200)

  // --- Search by name: "Alpha" → 2 hits (descending: Alpha Workshop, Alpha Launch) ---
  await salesEventListModel.search().queryInput().locator.fill('Alpha')

  await expect(salesEventListModel.list().rows().locator).toHaveCount(2)
  await expect(salesEventListModel.list().rows().row(0).idLink().locator).toHaveText(
    String(notableNumbers[1]),
  )
  await expect(salesEventListModel.list().rows().row(0).nameCell().locator).toContainText(
    'Alpha Workshop',
  )
  await expect(salesEventListModel.list().rows().row(1).idLink().locator).toHaveText(
    String(notableNumbers[0]),
  )
  // Verify products column renders product names as links
  await expect(salesEventListModel.list().rows().row(1).productsCell().locator).toContainText(
    'Intro Course',
  )
  // Verify product links navigate to the correct product pages
  await expect(
    salesEventListModel.list().rows().row(1).productsCell().productLink(0).locator,
  ).toHaveText('Intro Course')
  await expect(
    salesEventListModel.list().rows().row(1).productsCell().productLink(1).locator,
  ).toHaveText('Advanced Pack')

  const updateProductModel = createUpdateProductPageModel(page)

  await salesEventListModel.list().rows().row(1).productsCell().productLink(0).locator.click()
  await expect(updateProductModel.pageTitle().locator).toHaveText('Update Product 1')

  await page.goBack()

  // --- Search by landing page URL: "gamma-special" → 1 hit ---
  await page.goto(new URL('/sales-events', url()).href)

  await salesEventListModel.search().queryInput().locator.fill('gamma-special')
  await expect(salesEventListModel.list().rows().locator).toHaveCount(1)
  await expect(salesEventListModel.list().rows().row(0).nameCell().locator).toHaveText(
    'Gamma Promo',
  )

  // --- Search by date: "2025" → 3 hits (notables with dates in 2025) ---
  await salesEventListModel.search().queryInput().locator.fill('2025')

  await expect(salesEventListModel.list().rows().locator).toHaveCount(3)
  // Descending: Delta Seminar (5), Alpha Workshop (2), Alpha Launch (1)
  await expect(salesEventListModel.list().rows().row(0).nameCell().locator).toHaveText(
    'Delta Seminar',
  )

  // --- Archive / restore ---
  // Archive "Alpha Launch" (notable #0)
  await page.goto(url().href + `sales-events/${notableNumbers[0]}`)

  await updateSalesEventModel.form().deleteButton().locator.click()
  await expect(updateSalesEventModel.form().restoreButton().locator).toBeVisible()

  // Search "Alpha" — archived excluded, so only 1 result
  await page.goto(new URL('/sales-events', url()).href)
  await salesEventListModel.search().queryInput().locator.fill('Alpha')

  await expect(salesEventListModel.list().rows().locator).toHaveCount(1)
  await expect(salesEventListModel.list().rows().row(0).nameCell().locator).toContainText(
    'Alpha Workshop',
  )

  // Check "show archived" — archived reappears
  await salesEventListModel.search().showArchivedCheckbox().locator.check()
  await expect(salesEventListModel.list().rows().locator).toHaveCount(2)
  await expect(salesEventListModel.list().rows().row(0).nameCell().locator).toContainText(
    'Alpha Workshop',
  )
})

async function seedSalesEvents(sql: Sql): Promise<{notableNumbers: number[]}> {
  // Create the products referenced by notable sales events
  for (const name of PRODUCT_NAMES) {
    await createProduct({name, productType: 'recorded'}, undefined, new Date(), sql)
  }

  const notableNumbers: number[] = []

  for (const {salesEvent} of NOTABLE_SALES_EVENTS) {
    const num = await createSalesEvent(salesEvent, undefined, new Date(), sql)
    notableNumbers.push(num)
  }

  // Filler sales events: names "Event-NNN", dates in 2030, no landing page URL
  for (let i = 1; i <= FILLER_COUNT; i++) {
    const padded = String(i).padStart(3, '0')
    await createSalesEvent(
      {
        name: `Event-${padded}`,
        fromDate: new Date(`2030-07-${String((i % 28) + 1).padStart(2, '0')}`),
        toDate: new Date(`2030-08-${String((i % 28) + 1).padStart(2, '0')}`),
        productsForSale: [((i - 1) % PRODUCT_NAMES.length) + 1],
      },
      undefined,
      new Date(),
      sql,
    )
  }

  return {notableNumbers}
}

/**
 * Notable sales events with carefully chosen data for search/content assertions.
 * Created first, so they get the lowest sales event numbers.
 *
 * Filler sales events have names like "Event-NNN" with dates in 2030 and no landing page URL,
 * so they won't collide with search terms used for notables.
 */
const NOTABLE_SALES_EVENTS: {purpose: string; salesEvent: NewSalesEvent}[] = [
  {
    purpose: 'name search target #1 + archive target',
    salesEvent: {
      name: 'Alpha Launch',
      fromDate: new Date('2025-03-01'),
      toDate: new Date('2025-03-15'),
      landingPageUrl: 'https://example.com/alpha-launch',
      productsForSale: [1, 2],
    },
  },
  {
    purpose: 'name search target #2 (second "Alpha")',
    salesEvent: {
      name: 'Alpha Workshop',
      fromDate: new Date('2025-06-01'),
      toDate: new Date('2025-06-30'),
      productsForSale: [1],
    },
  },
  {
    purpose: 'unique name for single-result search',
    salesEvent: {
      name: 'Beta Webinar',
      fromDate: new Date('2030-01-01'),
      toDate: new Date('2030-01-15'),
      productsForSale: [2],
    },
  },
  {
    purpose: 'landing page URL search target',
    salesEvent: {
      name: 'Gamma Promo',
      landingPageUrl: 'https://example.com/gamma-special',
      fromDate: new Date('2030-02-01'),
      toDate: new Date('2030-02-28'),
      productsForSale: [1, 3],
    },
  },
  {
    purpose: 'date search target (2025)',
    salesEvent: {
      name: 'Delta Seminar',
      fromDate: new Date('2025-09-01'),
      toDate: new Date('2025-09-30'),
      productsForSale: [3],
    },
  },
  {
    purpose: 'additional product display check',
    salesEvent: {
      name: 'Epsilon Forum',
      fromDate: new Date('2030-03-01'),
      toDate: new Date('2030-03-31'),
      productsForSale: [1, 2, 3],
    },
  },
]

// Products referenced by notable sales events
const PRODUCT_NAMES = ['Intro Course', 'Advanced Pack', 'Pro Bundle']

const TOTAL_SALES_EVENTS = 200
const FILLER_COUNT = TOTAL_SALES_EVENTS - NOTABLE_SALES_EVENTS.length
