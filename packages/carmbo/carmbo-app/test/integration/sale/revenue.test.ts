import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createRevenuePageModel} from '../../page-model/sales/revenue-page.model.ts'
import {createSaleListPageModel} from '../../page-model/sales/sale-list-page.model.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {createSale} from '../../../src/domain/sale/model/model.ts'
import {cardcomWebhookUrl, cardcomRecurringPaymentWebhookUrl} from './common/cardcom-webhook.ts'

const {url, sql, setTime, smooveIntegration, cardcomIntegration} = setup(import.meta.url)

test.use({viewport: {width: 1024, height: 1024}})

// "now" is April 23, 2026
const now = new Date('2026-04-23T12:00:00Z')

// Dates in different time buckets relative to "now":
const threeDaysAgo = new Date('2026-04-20T12:00:00Z') // within week
const fiveDaysAgo = new Date('2026-04-18T12:00:00Z') // within week
const fifteenDaysAgo = new Date('2026-04-08T12:00:00Z') // within month but not week
const twentyFiveDaysAgo = new Date('2026-03-29T12:00:00Z') // within month but not week
const twoMonthsAgo = new Date('2026-02-23T12:00:00Z') // within YTD (2026) but not month
const threeMonthsAgo = new Date('2026-01-15T12:00:00Z') // within YTD (2026) but not month
const eightMonthsAgo = new Date('2025-08-23T12:00:00Z') // within year (365 days) but not YTD
const tenMonthsAgo = new Date('2025-06-23T12:00:00Z') // within year (365 days) but not YTD
const twoYearsAgo = new Date('2024-04-23T12:00:00Z') // outside all ranges

async function createTestData() {
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Test', lastName: 'Student'}],
      emails: ['test.student@example.com'],
      phones: [],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    now,
    sql(),
  )

  const student2Number = await createStudent(
    {
      names: [{firstName: 'Another', lastName: 'Student'}],
      emails: ['another.student@example.com'],
      phones: [],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    now,
    sql(),
  )

  const productNumber = await createProduct(
    {name: 'Test Product', productType: 'recorded'},
    undefined,
    now,
    sql(),
  )

  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Event',
      fromDate: new Date('2024-01-01'),
      toDate: new Date('2027-12-31'),
      landingPageUrl: 'https://example.com',
      productsForSale: [productNumber],
    },
    undefined,
    now,
    sql(),
  )

  return {studentNumber, student2Number, productNumber, salesEventNumber}
}

function makeSale(
  salesEventNumber: number,
  studentNumber: number,
  productNumber: number,
  revenue: number,
) {
  return {
    salesEventNumber,
    studentNumber,
    finalSaleRevenue: revenue,
    products: [{productNumber, quantity: 1, unitPrice: revenue}],
  }
}

test('shows revenue totals for all time periods with multiple sales', async ({page}) => {
  setTime(now)
  const {studentNumber, student2Number, productNumber, salesEventNumber} = await createTestData()

  const sale = (revenue: number) =>
    makeSale(salesEventNumber, studentNumber, productNumber, revenue)
  const sale2 = (revenue: number) =>
    makeSale(salesEventNumber, student2Number, productNumber, revenue)

  // Week sales (3 + 5 days ago): 100 + 200 = 300
  await createSale(sale(100), undefined, threeDaysAgo, sql())
  await createSale(sale2(200), undefined, fiveDaysAgo, sql())

  // Month-only sales (15 + 25 days ago): 150 + 250 = 400
  await createSale(sale(150), undefined, fifteenDaysAgo, sql())
  await createSale(sale2(250), undefined, twentyFiveDaysAgo, sql())

  // YTD-only sales (2 + 3 months ago in 2026): 300 + 400 = 700
  await createSale(sale(300), undefined, twoMonthsAgo, sql())
  await createSale(sale2(400), undefined, threeMonthsAgo, sql())

  // Year-only sales (8 + 10 months ago, in 2025): 500 + 600 = 1100
  await createSale(sale(500), undefined, eightMonthsAgo, sql())
  await createSale(sale2(600), undefined, tenMonthsAgo, sql())

  // Outside all ranges (2 years ago): should not count
  await createSale(sale(9999), undefined, twoYearsAgo, sql())

  // Expected totals:
  // Week:  300
  // Month: 300 + 400 = 700
  // YTD:   300 + 400 + 700 = 1400
  // Year:  300 + 400 + 700 + 1100 = 2500

  await page.goto(new URL('/sales/revenue', url()).href)

  const revenueModel = createRevenuePageModel(page)
  await page.waitForURL(revenueModel.urlRegex)

  await expect(revenueModel.pageTitle().locator).toHaveText('Revenue Summary')

  await expect(revenueModel.table().weekRow().amount().locator).toHaveText('₪300.00')
  await expect(revenueModel.table().monthRow().amount().locator).toHaveText('₪700.00')
  await expect(revenueModel.table().ytdRow().amount().locator).toHaveText('₪1,400.00')
  await expect(revenueModel.table().yearRow().amount().locator).toHaveText('₪2,500.00')
})

test('includes standing order payments in revenue', async ({page}) => {
  setTime(now)
  const {studentNumber, productNumber, salesEventNumber} = await createTestData()

  // Create a one-time sale 5 days ago: revenue 100
  await createSale(
    makeSale(salesEventNumber, studentNumber, productNumber, 100),
    undefined,
    fiveDaysAgo,
    sql(),
  )

  // Create a standing order sale via the Cardcom webhook (simulates real flow)
  // This creates the sale + first payment of 200
  const {recurringOrderId} = await cardcomIntegration()._test_simulateCardcomStandingOrder(
    {
      productsSold: [
        {
          productId: productNumber.toString(),
          quantity: 1,
          unitPriceInCents: 200 * 100,
          productName: 'Test Product',
        },
      ],
      customerEmail: 'standing-order@example.com',
      customerName: 'Standing Order Student',
      customerPhone: '0501234567',
      cardcomCustomerId: 1776,
      transactionDate: now,
      transactionDescription: undefined,
      transactionRevenueInCents: 200 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEventNumber, url(), ''),
    cardcomRecurringPaymentWebhookUrl(url(), ''),
  )

  // Second payment: 200
  await cardcomIntegration()._test_simulateCardcomStandingOrderPayment(
    recurringOrderId,
    {
      productsSold: [
        {
          productId: productNumber.toString(),
          quantity: 1,
          unitPriceInCents: 200 * 100,
          productName: 'Test Product',
        },
      ],
      customerEmail: 'standing-order@example.com',
      customerName: 'Standing Order Student',
      customerPhone: '0501234567',
      cardcomCustomerId: 1776,
      transactionDate: now,
      transactionDescription: undefined,
      transactionRevenueInCents: 200 * 100,
    },
    cardcomRecurringPaymentWebhookUrl(url(), ''),
  )

  // Third payment: 200
  await cardcomIntegration()._test_simulateCardcomStandingOrderPayment(
    recurringOrderId,
    {
      productsSold: [
        {
          productId: productNumber.toString(),
          quantity: 1,
          unitPriceInCents: 200 * 100,
          productName: 'Test Product',
        },
      ],
      customerEmail: 'standing-order@example.com',
      customerName: 'Standing Order Student',
      customerPhone: '0501234567',
      cardcomCustomerId: 1776,
      transactionDate: now,
      transactionDescription: undefined,
      transactionRevenueInCents: 200 * 100,
    },
    cardcomRecurringPaymentWebhookUrl(url(), ''),
  )

  // Expected:
  // One-time sale: 100 (5 days ago — in week)
  // Standing order (has recurring_order_id) excluded from one-time revenue query
  // Standing order payments (all at "now"): 200 + 200 + 200 = 600
  //
  // All amounts are within the week, so all periods show the same total:
  // Week:  100 + 600 = 700
  // Month: 700
  // YTD:   700
  // Year:  700

  await page.goto(new URL('/sales/revenue', url()).href)

  const revenueModel = createRevenuePageModel(page)
  await page.waitForURL(revenueModel.urlRegex)

  await expect(revenueModel.table().weekRow().amount().locator).toHaveText('₪700.00')
  await expect(revenueModel.table().monthRow().amount().locator).toHaveText('₪700.00')
  await expect(revenueModel.table().ytdRow().amount().locator).toHaveText('₪700.00')
  await expect(revenueModel.table().yearRow().amount().locator).toHaveText('₪700.00')
})

test('excludes archived sales from revenue', async ({page}) => {
  setTime(now)
  const {studentNumber, productNumber, salesEventNumber} = await createTestData()

  // Create two sales
  await createSale(
    makeSale(salesEventNumber, studentNumber, productNumber, 100),
    undefined,
    threeDaysAgo,
    sql(),
  )
  const archivedSaleNumber = await createSale(
    makeSale(salesEventNumber, studentNumber, productNumber, 500),
    undefined,
    threeDaysAgo,
    sql(),
  )

  // Archive the second sale
  const {deleteSale} = await import('../../../src/domain/sale/model/model.ts')
  await deleteSale(archivedSaleNumber, undefined, 'delete', now, sql())

  // Only the first sale (100) should count
  await page.goto(new URL('/sales/revenue', url()).href)

  const revenueModel = createRevenuePageModel(page)
  await page.waitForURL(revenueModel.urlRegex)

  await expect(revenueModel.table().weekRow().amount().locator).toHaveText('₪100.00')
})

test('revenue link from sales page navigates to revenue page', async ({page}) => {
  setTime(now)

  await page.goto(new URL('/sales', url()).href)

  const saleListModel = createSaleListPageModel(page)
  await page.waitForURL(saleListModel.urlRegex)

  await page.locator('a', {hasText: 'Revenue'}).click()

  const revenueModel = createRevenuePageModel(page)
  await page.waitForURL(revenueModel.urlRegex)

  await expect(revenueModel.pageTitle().locator).toHaveText('Revenue Summary')
})
