import {test, expect} from '@playwright/test'
import {setup} from '../../../common/setup.ts'
import {createProduct} from '../../../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../../../src/domain/sales-event/model/model.ts'
import {createUpdateSalePageModel} from '../../../../page-model/sales/update-sale-page.model.ts'
import {cardcomWebhookUrl} from '../../common/cardcom-webhook.ts'
import {createStudent} from '../../../../../src/domain/student/model.ts'
import {createNewSalePageModel} from '../../../../page-model/sales/new-sale-page.model.ts'

const {url, sql, cardcomIntegration} = setup(import.meta.url, {
  withAcademyIntegration: false,
  withSmooveIntegration: false,
  withSkoolIntegration: true,
})

test.use({viewport: {width: 1024, height: 1400}})

test('disconnect cardcom sale removes disconnect button and disconnects from external providers', async ({
  page,
}) => {
  // Create a simple product with external providers
  const productNumber = await createProduct(
    {
      name: 'Test Product',
      productType: 'recorded',
    },
    undefined,
    new Date(),
    sql(),
  )

  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/test-sale',
      productsForSale: [productNumber],
    },
    undefined,
    new Date(),
    sql(),
  )

  const customerEmail = 'disconnect-customer@example.com'
  const customerName = 'Disconnect Customer'
  const customerPhone = '0509999999'

  // Simulate a cardcom sale
  await cardcomIntegration()._test_simulateCardcomSale(
    {
      productsSold: [
        {
          productId: productNumber.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Test Product',
        },
      ],
      customerEmail,
      customerName,
      customerPhone,
      cardcomCustomerId: 5555,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 100 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
  )

  // Navigate to the sale detail page
  await page.goto(new URL('/sales/1', url()).href)
  await page.waitForURL(/\/sales\/\d+$/)

  const saleDetailModel = createUpdateSalePageModel(page)

  // Verify the sale is connected to external providers
  await expect(saleDetailModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Click the disconnect button
  await saleDetailModel.form().disconnectButton().locator.click()

  // Wait for the disconnect to be processed (the button should disappear)
  await expect(saleDetailModel.form().reconnectButton().locator).not.toBeVisible()
  await expect(saleDetailModel.form().disconnectButton().locator).not.toBeVisible()
  await expect(saleDetailModel.form().updateButton().locator).toBeVisible()
  await expect(saleDetailModel.form().connectButton().locator).toBeVisible()

  // Verify sale status shows disconnected from external providers
  await expect(saleDetailModel.saleStatus().locator).toHaveText(
    'Regular Sale | Disconnected from External Providers',
  )

  // Verify that a disconnect history row was added
  const historyList = saleDetailModel.history()
  await expect(historyList.items().locator).toHaveCount(2) // create + disconnect
  await expect(historyList.items().item(0).locator).toContainText('disconnected manually')
})

test('disconnect manual sale removes disconnect button and disconnects from external providers', async ({
  page,
}) => {
  const customerEmail = 'manual-disconnect-customer@example.com'

  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Manual', lastName: 'Customer'}],
      emails: [customerEmail],
      phones: ['0501111111'],
      facebookNames: [],
    },
    undefined,
    undefined,
    new Date(),
    sql(),
  )

  // Create a simple product with external providers
  const productNumber = await createProduct(
    {
      name: 'Test Product',
      productType: 'recorded',
    },
    undefined,
    new Date(),
    sql(),
  )

  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/test-sale',
      productsForSale: [productNumber],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a manual sale through the UI
  await page.goto(new URL('/sales/new', url()).href)

  const newSaleModel = createNewSalePageModel(page)
  const newForm = newSaleModel.form()

  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).quantity().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.products().product(0).unitPrice().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.finalSaleRevenueInput().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.createButton().locator.click()

  // Wait for redirect to sale detail page
  await page.waitForURL(/\/sales\/\d+$/)

  const saleDetailModel = createUpdateSalePageModel(page)

  // Verify the disconnect button is not yet visible (sale is not connected)
  await expect(saleDetailModel.form().disconnectButton().locator).not.toBeVisible()

  // Verify the sale status shows disconnected
  await expect(saleDetailModel.saleStatus().locator).toHaveText(
    'Regular Sale | Disconnected from External Providers',
  )

  // Connect the sale to make it active
  await saleDetailModel.form().connectButton().locator.click()

  // Wait for the page to reload after connect
  await page.waitForLoadState('networkidle')

  // Verify the disconnect button is now visible
  await expect(saleDetailModel.form().disconnectButton().locator).toBeVisible()

  // Verify sale status shows connected
  await expect(saleDetailModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Click the disconnect button
  await saleDetailModel.form().disconnectButton().locator.click()

  // Wait for the disconnect to be processed
  await page.waitForLoadState('networkidle')

  // Verify the disconnect button is gone
  await expect(saleDetailModel.form().disconnectButton().locator).not.toBeVisible()

  // Verify sale status shows disconnected from external providers
  await expect(saleDetailModel.saleStatus().locator).toHaveText(
    'Regular Sale | Disconnected from External Providers',
  )

  // Verify that a disconnect history row was added
  const historyList = saleDetailModel.history()
  await expect(historyList.items().locator).toHaveCount(4) // create + updated + connect + disconnect
  await expect(historyList.items().item(0).locator).toContainText('disconnected manually')

  // Verify the reconnect button is visible after disconnecting
  await expect(saleDetailModel.form().reconnectButton().locator).not.toBeVisible()
  await expect(saleDetailModel.form().disconnectButton().locator).not.toBeVisible()
  await expect(saleDetailModel.form().updateButton().locator).toBeVisible()
  await expect(saleDetailModel.form().connectButton().locator).toBeVisible()

  await saleDetailModel.form().connectButton().locator.click()

  // Wait for the connect to be processed
  await page.waitForLoadState('networkidle')

  // Verify sale status shows connected again
  await expect(saleDetailModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Verify the disconnect button is visible again
  await expect(saleDetailModel.form().disconnectButton().locator).toBeVisible()

  // Verify that a reconnect history row was added
  await expect(historyList.items().locator).toHaveCount(6) // create + update + connect + disconnect + connect + update
})
