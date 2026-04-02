import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createUpdateSalesEventPageModel} from '../../page-model/sales-events/update-sales-event-page.model.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {createSale} from '../../../src/domain/sale/model/model.ts'
import {cardcomWebhookUrl} from '../sale/common/cardcom-webhook.ts'
import {addQueryParamsToUrl} from '@giltayar/url-commons'
import {fetchAsText} from '@giltayar/http-commons'

const {url, sql, smooveIntegration, cardcomIntegration} = setup(import.meta.url)

test.use({viewport: {width: 1280, height: 1000}})

test('sales event page shows sales statistics for manual, cardcom, and no-invoice sales', async ({
  page,
}) => {
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Alice', lastName: 'Johnson'}],
      emails: ['alice@example.com'],
      phones: [],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  const product1Number = await createProduct(
    {name: 'Product A', productType: 'recorded'},
    undefined,
    new Date(),
    sql(),
  )

  const product2Number = await createProduct(
    {name: 'Product B', productType: 'recorded'},
    undefined,
    new Date(),
    sql(),
  )

  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      productsForSale: [product1Number, product2Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Manual sale with revenue 100
  await createSale(
    {
      salesEventNumber,
      studentNumber,
      finalSaleRevenue: 100,
      products: [{productNumber: product1Number, quantity: 1, unitPrice: 100}],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Cardcom sale with revenue 200
  await cardcomIntegration()._test_simulateCardcomSale(
    {
      productsSold: [
        {
          productId: product1Number.toString(),
          quantity: 1,
          unitPriceInCents: 200 * 100,
          productName: 'Product A',
        },
      ],
      customerEmail: 'cardcom-customer@example.com',
      customerName: 'Bob Smith',
      customerPhone: '0501234567',
      cardcomCustomerId: undefined,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 200 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
  )

  // No-invoice sale with revenue 0
  await fetchAsText(
    addQueryParamsToUrl(new URL('/api/sales/no-invoice-sale', url()), {
      secret: 'secret',
      'sales-event': salesEventNumber.toString(),
      email: 'no-invoice@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    }),
  )

  await page.goto(new URL(`/sales-events/${salesEventNumber}`, url()).href)

  const updateModel = createUpdateSalesEventPageModel(page)
  const stats = updateModel.salesStatistics()

  await expect(stats.locator).toBeVisible()
  await expect(stats.numberOfSales().locator).toHaveText('3')
  await expect(stats.totalRevenue().locator).toHaveText('300')
  await expect(stats.averageSalePrice().locator).toHaveText('100')
})

test('sales event page does not show sales statistics when there are no sales', async ({page}) => {
  const salesEventNumber = await createSalesEvent(
    {
      name: 'Empty Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
    },
    undefined,
    new Date(),
    sql(),
  )

  await page.goto(new URL(`/sales-events/${salesEventNumber}`, url()).href)

  const updateModel = createUpdateSalesEventPageModel(page)
  const stats = updateModel.salesStatistics()

  await expect(stats.locator).not.toBeVisible()
})
