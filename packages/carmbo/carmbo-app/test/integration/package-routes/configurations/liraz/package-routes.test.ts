import {expect, test} from '@playwright/test'
import {createNewProductPageModel} from '@giltayar/carmbo-pages-sale/testkit/page-model/products/new-product-page.model'
import {createProductListPageModel} from '@giltayar/carmbo-pages-sale/testkit/page-model/products/product-list-page.model'
import {createNewSalesEventPageModel} from '@giltayar/carmbo-pages-sale/testkit/page-model/sales-events/new-sales-event-page.model'
import {createSalesEventListPageModel} from '@giltayar/carmbo-pages-sale/testkit/page-model/sales-events/sales-event-list-page.model'
import {createSaleListPageModel} from '@giltayar/carmbo-pages-sale/testkit/page-model/sales/sale-list-page.model'
import {waitForHtmx} from '@giltayar/playwright-commons'
import {setup} from '../../../common/setup.ts'
import {cardcomWebhookUrl} from '../../../common/cardcom-webhook.ts'

const {url, cardcomIntegration} = setup(import.meta.url, {
  uiConfiguration: 'liraz',
  withAcademyIntegration: false,
  withSmooveIntegration: false,
  withRavmesserIntegration: false,
})

test('sale package routes create a Cardcom sale', async ({page}) => {
  await page.goto(new URL('/products', url()).href)

  const productList = createProductListPageModel(page)
  await productList.createNewProductButton().locator.click()

  const newProduct = createNewProductPageModel(page)
  await page.waitForURL(newProduct.urlRegex)

  const form = newProduct.form()
  await form.nameInput().locator.fill('Mounted package product')
  await form.productTypeSelect().locator.selectOption('recorded')
  await form.createButton().locator.click()
  await page.waitForURL(/\/products\/\d+$/)

  const productNumber = Number(new URL(page.url()).pathname.split('/').at(-1))

  await page.goto(new URL('/sales-events', url()).href)

  const salesEventList = createSalesEventListPageModel(page)
  await salesEventList.createNewSalesEventButton().locator.click()

  const newSalesEvent = createNewSalesEventPageModel(page)
  await page.waitForURL(newSalesEvent.urlRegex)

  const salesEventForm = newSalesEvent.form()
  await salesEventForm.nameInput().locator.fill('Mounted package sales event')
  await salesEventForm.fromDateInput().locator.fill('2026-01-01')
  await salesEventForm.toDateInput().locator.fill('2026-12-31')
  await salesEventForm.landingPageUrlInput().locator.fill('https://example.com/sale')
  await waitForHtmx(page, salesEventForm.productsForSale().addButton().locator.click())
  await waitForHtmx(page, async () => {
    await salesEventForm.productsForSale().productInput(0).locator.fill(productNumber.toString())
    await salesEventForm.productsForSale().productInput(0).locator.blur()
  })
  await salesEventForm.createButton().locator.click()
  await page.waitForURL(/\/sales-events\/\d+$/)

  const salesEventNumber = Number(new URL(page.url()).pathname.split('/').at(-1))
  await cardcomIntegration()._test_simulateCardcomSale(
    {
      productsSold: [
        {
          productId: productNumber.toString(),
          quantity: 1,
          unitPriceInCents: 10_000,
          productName: 'Mounted package product',
        },
      ],
      customerEmail: 'mounted-sale@example.com',
      customerName: 'Mounted Sale',
      customerPhone: '0501234567',
      cardcomCustomerId: 1234,
      transactionDate: new Date('2026-10-05T12:00:00.000Z'),
      transactionDescription: undefined,
      transactionRevenueInCents: 10_000,
    },
    undefined,
    cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
  )

  await page.goto(new URL('/sales', url()).href)

  const saleRows = createSaleListPageModel(page).list().rows()
  await expect(saleRows.locator).toHaveCount(1)
  await expect(saleRows.row(0).eventCell().locator).toHaveText('Mounted package sales event')
  await expect(saleRows.row(0).studentCell().locator).toHaveText('Mounted Sale')
  await expect(saleRows.row(0).revenueCell().locator).toContainText('100')
  await expect(saleRows.row(0).productsCell().locator).toContainText('Mounted package product')
})
