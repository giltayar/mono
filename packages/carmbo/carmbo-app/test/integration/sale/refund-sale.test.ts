import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {cardcomWebhookUrl} from './common/cardcom-webhook.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {createNewSalePageModel} from '../../page-model/sales/new-sale-page.model.ts'

const {url, sql, cardcomIntegration, smooveIntegration} = setup(import.meta.url)

test.use({viewport: {width: 1024, height: 1024}})

test('refund cardcom sale removes refund button and refunds in cardcom', async ({page}) => {
  // Create a simple product
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

  const customerEmail = 'refund-customer@example.com'
  const customerName = 'Refund Customer'
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
      transactionRevenueInCents: 100 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
  )

  // Navigate to the sale detail page
  await page.goto(new URL('/sales/1', url()).href)
  await page.waitForURL(/\/sales\/\d+$/)

  const saleDetailModel = createUpdateSalePageModel(page)

  // Verify the refund button is visible
  await expect(saleDetailModel.form().refundButton().locator).toBeVisible()

  // Get the cardcom invoice number (transaction ID)
  const cardcomInvoiceNumber = await saleDetailModel
    .form()
    .cardcomInvoiceNumberInput()
    .locator.inputValue()

  // Verify the payment is not refunded yet
  expect(await cardcomIntegration()._test_isPaymentRefunded(parseInt(cardcomInvoiceNumber))).toBe(
    false,
  )

  // Click the refund button
  await saleDetailModel.form().refundButton().locator.click()

  // Wait for the refund to be processed (the button should disappear)
  await expect(saleDetailModel.form().refundButton().locator).not.toBeVisible()

  // Verify the payment is now refunded in cardcom
  expect(await cardcomIntegration()._test_isPaymentRefunded(parseInt(cardcomInvoiceNumber))).toBe(
    true,
  )

  // Verify that a refund history row was added
  const historyList = saleDetailModel.history()
  await expect(historyList.items().locator).toHaveCount(2) // create + refund
  await expect(historyList.items().item(0).locator).toContainText('refunded sale')
})

test('refund manual sale shows confirmation and only adds history row', async ({page}) => {
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Manual', lastName: 'Customer'}],
      emails: ['manual-customer@example.com'],
      phones: ['0501111111'],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  // Create a simple product
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
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()

  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.fill('100')

  await newForm.createButton().locator.click()

  // Wait for redirect to sale detail page
  await page.waitForURL(/\/sales\/\d+$/)

  const saleDetailModel = createUpdateSalePageModel(page)

  // Verify the refund button is not yet visible
  await expect(saleDetailModel.form().refundButton().locator).not.toBeVisible()

  // Connect the sale to make it active
  await saleDetailModel.form().connectButton().locator.click()

  // Wait for the page to reload after connect
  await page.waitForLoadState('networkidle')

  // Verify the refund button is visible
  await expect(saleDetailModel.form().refundButton().locator).toBeVisible()

  // Set up dialog handler to accept the confirmation
  let dialogShown = false
  let dialogMessage = ''
  page.on('dialog', async (dialog) => {
    dialogShown = true
    dialogMessage = dialog.message()
    await dialog.accept()
  })

  // Click the refund button
  await saleDetailModel.form().refundButton().locator.click()

  // Verify that the confirmation dialog was shown with the correct message
  expect(dialogShown).toBe(true)
  expect(dialogMessage).toContain('This sale is manual!')
  expect(dialogMessage).toContain('You MUST process the refund in Cardcom')

  // Wait for the page to reload after the refund
  await page.waitForLoadState('networkidle')

  // The refund button should still be visible (refund didn't actually happen)
  await expect(saleDetailModel.form().refundButton().locator).toBeVisible()

  // Verify that a refund history row was added
  const historyList = saleDetailModel.history()
  await expect(historyList.items().locator).toHaveCount(3) // create + connect-sale + refund-sale
  await expect(historyList.items().item(0).locator).toContainText('refunded sale')
})
