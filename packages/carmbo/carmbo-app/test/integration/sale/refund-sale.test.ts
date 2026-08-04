import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model/model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {createSaleListPageModel} from '../../page-model/sales/sale-list-page.model.ts'
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

  // Verify the refund button is visible
  await expect(saleDetailModel.form().refundButton().locator).toBeVisible()
  await expect(saleDetailModel.refundDialog().locator).toHaveCount(0)

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

  const refundDialog = saleDetailModel.refundDialog()
  await expect(refundDialog.locator).toBeVisible()
  await expect(refundDialog.fullRefundRadio().locator).toBeChecked()
  await expect(refundDialog.amountInput().locator).toBeDisabled()

  await refundDialog.cancelButton().locator.click()
  await expect(refundDialog.locator).not.toBeVisible()
  expect(await cardcomIntegration()._test_isPaymentRefunded(parseInt(cardcomInvoiceNumber))).toBe(
    false,
  )

  await saleDetailModel.form().refundButton().locator.click()
  await refundDialog.refundButton().locator.click()

  // Wait for the refund to be processed (the button should disappear)
  await expect(saleDetailModel.form().refundButton().locator).not.toBeVisible()
  await expect(saleDetailModel.form().updateButton().locator).toBeVisible()
  await expect(saleDetailModel.form().discardButton().locator).not.toBeVisible()

  // Verify sale status shows refunded
  await expect(saleDetailModel.saleStatus().locator).toHaveText(
    'Regular Sale | Refunded | Connected to External Providers',
  )

  // Verify the payment is now refunded in cardcom
  expect(await cardcomIntegration()._test_isPaymentRefunded(parseInt(cardcomInvoiceNumber))).toBe(
    true,
  )

  // Verify that a refund history row was added
  const historyList = saleDetailModel.history()
  await expect(historyList.items().locator).toHaveCount(2) // create + refund
  await expect(historyList.items().item(0).locator).toContainText('refunded sale')

  // Verify the sales list page shows "(refunded)" in the revenue cell
  await page.goto(new URL('/sales', url()).href)
  const saleListModel = createSaleListPageModel(page)
  const firstRow = saleListModel.list().rows().row(0)
  await expect(firstRow.revenueCell().locator).toContainText('(refunded)')
})

test('partially refund cardcom sale validates and records the amount', async ({page}) => {
  const productNumber = await createProduct(
    {name: 'Partial Refund Product', productType: 'recorded'},
    undefined,
    new Date(),
    sql(),
  )
  const salesEventNumber = await createSalesEvent(
    {
      name: 'Partial Refund Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/partial-refund-sale',
      productsForSale: [productNumber],
    },
    undefined,
    new Date(),
    sql(),
  )
  await cardcomIntegration()._test_simulateCardcomSale(
    {
      productsSold: [
        {
          productId: productNumber.toString(),
          quantity: 1,
          unitPriceInCents: 10000,
          productName: 'Partial Refund Product',
        },
      ],
      customerEmail: 'partial-refund@example.com',
      customerName: 'Partial Refund Customer',
      customerPhone: '0502222222',
      cardcomCustomerId: 5556,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 10000,
    },
    undefined,
    cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
  )

  await page.goto(new URL('/sales/1', url()).href)
  const saleDetailModel = createUpdateSalePageModel(page)
  const cardcomInvoiceNumber = await saleDetailModel
    .form()
    .cardcomInvoiceNumberInput()
    .locator.inputValue()

  await saleDetailModel.form().refundButton().locator.click()
  const refundDialog = saleDetailModel.refundDialog()
  await refundDialog.partialRefundRadio().locator.check()
  await expect(refundDialog.amountInput().locator).toBeEnabled()
  await refundDialog.amountInput().locator.fill('100')
  await refundDialog.refundButton().locator.click()

  await expect(saleDetailModel.header().errorBanner().locator).toContainText(
    'Partial refund amount must be less than the sale revenue',
  )
  expect(await cardcomIntegration()._test_isPaymentRefunded(parseInt(cardcomInvoiceNumber))).toBe(
    false,
  )

  await refundDialog.amountInput().locator.fill('25.50')
  await refundDialog.refundButton().locator.click()

  await expect(saleDetailModel.form().refundButton().locator).not.toBeVisible()
  await expect(saleDetailModel.saleStatus().locator).toHaveText(
    'Regular Sale | Partially refunded ₪25.50 | Connected to External Providers',
  )
  expect(
    cardcomIntegration()._test_getPaymentRefundPartialSum(parseInt(cardcomInvoiceNumber)),
  ).toBe(25.5)

  const [refund] = (await sql()`
    SELECT refund_partial_sum::float8 AS refund_partial_sum
    FROM sale_data_cardcom
    JOIN sale USING (data_cardcom_id)
    WHERE sale_number = 1
  `) as {refundPartialSum: number}[]
  expect(refund.refundPartialSum).toBe(25.5)
})

test('refund manual sale allows full refund only', async ({page}) => {
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

  // Verify the refund button is not yet visible
  await expect(saleDetailModel.form().refundButton().locator).not.toBeVisible()

  // Connect the sale to make it active
  await saleDetailModel.form().connectButton().locator.click()
  await saleDetailModel.connectDialog().createInvoiceRadio().locator.check()
  await saleDetailModel.connectDialog().connectButton().locator.click()

  // Wait for the page to reload after connect
  await page.waitForLoadState('networkidle')

  // Verify the refund button is visible
  await expect(saleDetailModel.form().refundButton().locator).toBeVisible()
  const historyList = saleDetailModel.history()
  const historyCountBeforeRefund = await historyList.items().locator.count()

  // Click the refund button
  await saleDetailModel.form().refundButton().locator.click()

  const refundDialog = saleDetailModel.refundDialog()
  await expect(refundDialog.locator).toBeVisible()
  await expect(refundDialog.warning().locator).toContainText(
    'You must process the refund in Cardcom',
  )
  await expect(refundDialog.fullRefundRadio().locator).toBeChecked()
  await expect(refundDialog.partialRefundRadio().locator).toBeDisabled()
  await refundDialog.refundButton().locator.click()

  // Wait for the page to reload after the refund
  await page.waitForLoadState('networkidle')

  await expect(saleDetailModel.form().refundButton().locator).not.toBeVisible()

  // Verify that a refund history row was added
  await expect(historyList.items().locator).toHaveCount(historyCountBeforeRefund + 1)
  await expect(historyList.items().item(0).locator).toContainText('refunded sale')

  // Verify sale status shows refunded
  await expect(saleDetailModel.saleStatus().locator).toHaveText(
    'Regular Sale | Refunded | Connected to External Providers',
  )
})
