import {test, expect} from '@playwright/test'
import {setup} from '../../../common/setup.ts'
import {createProduct} from '../../../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../../../src/domain/sales-event/model/model.ts'
import {createStudentListPageModel} from '../../../../page-model/students/student-list-page.model.ts'
import {createSaleListPageModel} from '../../../../page-model/sales/sale-list-page.model.ts'
import {createUpdateSalePageModel} from '../../../../page-model/sales/update-sale-page.model.ts'
import {createSalePaymentsPageModel} from '../../../../page-model/sales/sale-payments-page.model.ts'
import {fetchAsTextWithJsonBody} from '@giltayar/http-commons'
import type {
  CardcomDetailRecurringJson,
  CardcomMasterRecurringJson,
} from '@giltayar/carmel-tools-cardcom-integration/types'
import {cardcomRecurringPaymentWebhookUrl, cardcomWebhookUrl} from '../../common/cardcom-webhook.ts'
import {humanIsraeliPhoneNumberToWhatsAppId} from '@giltayar/carmel-tools-whatsapp-integration/utils'
import {createSaleProvidersPageModel} from '../../../../page-model/sales/sale-providers-page.model.ts'
import {cancelSubscription} from '../../../common/cancel-subscription.ts'
import {createCancelSubscriptionPageModel} from '../../../../page-model/sales/cancel-subscription-page.model.ts'

const {url, sql, cardcomIntegration, whatsappIntegration} = setup(import.meta.url, {
  withAcademyIntegration: false,
  withSmooveIntegration: false,
  withSkoolIntegration: true,
})

test.use({viewport: {width: 1280, height: 1280}})

test('cardcom standing order creates student, sale with one payment', async ({page}) => {
  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
    },
    undefined,
    new Date(),
    sql(),
  )

  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'challenge',
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
      productsForSale: [product1Number, product2Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  const customerEmail = 'test-customer@example.com'
  const customerName = 'John Doe'
  const customerPhone = '0501234567'

  const {recurringOrderId} = await cardcomIntegration()._test_simulateCardcomStandingOrder(
    {
      productsSold: [
        {
          productId: product1Number.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Product One',
        },
        {
          productId: product2Number.toString(),
          quantity: 2,
          unitPriceInCents: 50 * 100,
          productName: 'Product Two',
        },
      ],
      customerEmail,
      customerName,
      customerPhone,
      cardcomCustomerId: 1776,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 200 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
    cardcomRecurringPaymentWebhookUrl(url(), 'secret'),
  )

  // Navigate to students list and verify student was created
  await page.goto(new URL('/students', url()).href)

  const studentListModel = createStudentListPageModel(page)
  const studentRows = studentListModel.list().rows()

  await expect(studentRows.locator).toHaveCount(1)

  const firstStudentRow = studentRows.row(0)
  await expect(firstStudentRow.nameCell().locator).toHaveText('John Doe')
  await expect(firstStudentRow.emailCell().locator).toHaveText(customerEmail)
  await expect(firstStudentRow.phoneCell().locator).toHaveText(customerPhone)

  // Navigate to sales list and verify sale was created
  await page.goto(new URL('/sales', url()).href)

  const saleListModel = createSaleListPageModel(page)
  const saleRows = saleListModel.list().rows()

  await expect(saleRows.locator).toHaveCount(1)

  const firstSaleRow = saleRows.row(0)
  await expect(firstSaleRow.eventCell().locator).toHaveText('Test Sales Event')
  await expect(firstSaleRow.studentCell().locator).toHaveText('John Doe')
  await expect(firstSaleRow.revenueCell().locator).toContainText('200')
  await expect(firstSaleRow.productsCell().locator).toContainText('Product One')
  await expect(firstSaleRow.productsCell().locator).toContainText('Product Two')

  // Click on the sale to view the sale detail page
  await firstSaleRow.idLink().locator.click()
  await page.waitForURL(/\/sales\/\d+$/)

  const saleDetailModel = createUpdateSalePageModel(page)

  await expect(saleDetailModel.pageTitle().locator).toHaveText('Sale 1')
  await expect(saleDetailModel.saleStatus().locator).toHaveText(
    'Subscription | Connected to External Providers',
  )

  // Verify sale details
  await expect(saleDetailModel.form().salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await expect(saleDetailModel.form().studentInput().locator).toHaveValue('1: John Doe')
  await expect(saleDetailModel.form().finalSaleRevenueInput().locator).toHaveValue('200')

  // Verify this is a standing order (should have invoice number)
  await expect(saleDetailModel.form().cardcomInvoiceNumberInput().locator).toHaveValue('1')
  await expect(saleDetailModel.form().viewInvoiceLink().locator).toHaveAttribute(
    'href',
    'http://invoice-document.example.com/1',
  )

  // Verify that refund button is not visible for standing orders
  await expect(saleDetailModel.form().refundButton().locator).not.toBeVisible()

  // Verify products in the sale detail page
  const products = saleDetailModel.form().products()
  await expect(products.locator).toHaveCount(2)

  const product1 = products.product(0)
  await expect(product1.title().locator).toContainText('Product One')
  await expect(product1.locator).toContainText(`${product1Number}: Product One`)
  await expect(product1.quantity().locator).toHaveValue('1')
  await expect(product1.unitPrice().locator).toHaveValue('100')

  const product2 = products.product(1)
  await expect(product2.title().locator).toContainText('Product Two')
  await expect(product2.quantity().locator).toHaveValue('2')
  await expect(product2.unitPrice().locator).toHaveValue('50')

  // Navigate to the payments tab
  await page.goto(new URL('/sales/1/payments', url()).href)
  await page.waitForURL(/\/sales\/\d+\/payments$/)

  const paymentsPageModel = createSalePaymentsPageModel(page)

  await expect(paymentsPageModel.pageTitle().locator).toHaveText('Sale 1 Payments')

  // Verify there is exactly one payment
  const paymentsTable = paymentsPageModel.paymentsTable()
  const paymentRows = paymentsTable.rows()

  await expect(paymentRows.locator).toHaveCount(1)

  // Verify the payment details
  const firstPayment = paymentRows.row(0)
  await expect(firstPayment.amountCell().locator).toContainText('200')
  await expect(firstPayment.resolutionCell().locator).toContainText('payed')
  await expect(firstPayment.invoiceNumberCell().locator).toContainText('1')

  // Simulate a second payment for the standing order
  await cardcomIntegration()._test_simulateCardcomStandingOrderPayment(
    recurringOrderId,
    {
      productsSold: [
        {
          productId: product1Number.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Product One',
        },
        {
          productId: product2Number.toString(),
          quantity: 2,
          unitPriceInCents: 50 * 100,
          productName: 'Product Two',
        },
      ],
      customerEmail,
      customerName,
      customerPhone,
      cardcomCustomerId: 1776,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 200 * 100,
    },
    cardcomRecurringPaymentWebhookUrl(url(), 'secret'),
  )

  // Reload the payments page to verify the second payment was created
  await page.reload()

  // Verify there are now two payments
  await expect(paymentRows.locator).toHaveCount(2)

  // Verify the second payment details
  const secondPayment = paymentRows.row(1)
  await expect(secondPayment.amountCell().locator).toContainText('200')
  await expect(secondPayment.resolutionCell().locator).toContainText('payed')
})

test('cardcom master recurring webhooks are ignored', async () => {
  const result = await fetchAsTextWithJsonBody(
    new URL('/api/sales/cardcom/recurring-payment?secret=', url()),
    {
      RecordType: 'MasterRecurring',
      RecurringId: '12345',
      'FlexItem.Price': '10000',
    } as CardcomMasterRecurringJson as Record<string, number | string>,
  )

  expect(result).toBe('ok')
})

test('cardcom detail recurring webhooks from a sale that is not in the system are ignored', async () => {
  const result = await fetchAsTextWithJsonBody(
    new URL('/api/sales/cardcom/recurring-payment?secret=', url()),
    {
      RecordType: 'DetailRecurring',
      RecurringId: '12345',
      BillingAttempts: 1,
      DocumentNumber: 1,
      InternalDealNumber: '111',
      Status: 'SUCCESSFUL',
      Sum: 10000,
    } as CardcomDetailRecurringJson as Record<string, number | string>,
  )

  expect(result).toBe('ok')
})

test('cancelling a standing order subscription by product number', async ({page}) => {
  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      whatsappGroups: [{id: '1@g.us'}, {id: '3@g.us'}],
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
      productsForSale: [product1Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  const customerEmail = 'test-customer@example.com'
  const customerName = 'John Doe'
  const customerPhone = '0501234567'

  // Create a standing order sale
  await cardcomIntegration()._test_simulateCardcomStandingOrder(
    {
      productsSold: [
        {
          productId: product1Number.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Product One',
        },
      ],
      customerEmail,
      customerName,
      customerPhone,
      cardcomCustomerId: 1776,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 100 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
    cardcomRecurringPaymentWebhookUrl(url(), 'secret'),
  )

  // Adding student to whatsapp group is done manually by the student
  await whatsappIntegration().addParticipantToGroup(
    '1@g.us',
    humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
  )
  await whatsappIntegration().addParticipantToGroup(
    '3@g.us',
    humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
  )
  // Verify student was added to whatsapp groups
  expect(await whatsappIntegration()._test_listParticipantsInGroup('1@g.us')).toContain(
    humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
  )
  expect(await whatsappIntegration()._test_listParticipantsInGroup('3@g.us')).toContain(
    humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
  )

  // Verify providers page shows everything connected
  await page.goto(new URL('/sales/1/providers', url()).href)
  await page.waitForURL(/\/sales\/1\/providers$/)

  const providersPageModel = createSaleProvidersPageModel(page)
  const productCards = providersPageModel.productCards()
  const productCard = productCards.card(0)

  // Verify whatsapp groups are connected
  const whatsappGroups = productCard.whatsAppGroups()
  await expect(whatsappGroups.groupCheckbox('1@g.us').locator).toBeChecked()
  await expect(whatsappGroups.groupName('1@g.us').locator).toHaveText('1@g.us: Test Group 1')
  await expect(whatsappGroups.groupCheckbox('3@g.us').locator).toBeChecked()
  await expect(whatsappGroups.groupName('3@g.us').locator).toHaveText('3@g.us: Test Group 3')

  // Cancel the subscription via the cancel subscription page using product number
  await cancelSubscription(page, url(), product1Number, customerEmail)
  const saleDetailModel = createUpdateSalePageModel(page)
  const saleHistory = saleDetailModel.history()

  await expect(async () => {
    // Navigate to the sale page to verify the history
    await page.goto(new URL('/sales/1', url()).href)

    // Verify the sale history includes a cancel-subscription entry
    await expect(saleHistory.items().locator).toHaveCount(2)
    await expect(saleHistory.items().item(0).locator).toContainText('canceled subscription')
    await expect(saleHistory.items().item(1).locator).toContainText('created')
  }).toPass()

  // Verify sale status shows unsubscribed
  await expect(saleDetailModel.saleStatus().locator).toHaveText(
    'Subscription (unsubscribed) | Connected to External Providers',
  )
})

test('cancelling a subscription by product fails when multiple sales exist for the same product', async ({
  page,
}) => {
  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
    },
    undefined,
    new Date(),
    sql(),
  )

  const salesEvent1Number = await createSalesEvent(
    {
      name: 'Sales Event One',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-06-30'),
      landingPageUrl: 'https://example.com/event-1',
      productsForSale: [product1Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  const salesEvent2Number = await createSalesEvent(
    {
      name: 'Sales Event Two',
      fromDate: new Date('2025-07-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/event-2',
      productsForSale: [product1Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  const customerEmail = 'test-customer@example.com'
  const customerName = 'John Doe'
  const customerPhone = '0501234567'

  // Create first standing order sale (via sales event 1)
  await cardcomIntegration()._test_simulateCardcomStandingOrder(
    {
      productsSold: [
        {
          productId: product1Number.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Product One',
        },
      ],
      customerEmail,
      customerName,
      customerPhone,
      cardcomCustomerId: 1776,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 100 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEvent1Number, url(), 'secret'),
    cardcomRecurringPaymentWebhookUrl(url(), 'secret'),
  )

  // Create second standing order sale (via sales event 2, same product)
  await cardcomIntegration()._test_simulateCardcomStandingOrder(
    {
      productsSold: [
        {
          productId: product1Number.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Product One',
        },
      ],
      customerEmail,
      customerName,
      customerPhone,
      cardcomCustomerId: 1777,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 100 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEvent2Number, url(), 'secret'),
    cardcomRecurringPaymentWebhookUrl(url(), 'secret'),
  )

  // Wait for both sales to be created
  await expect(async () => {
    await page.goto(new URL('/sales', url()).href)
    const saleListModel = createSaleListPageModel(page)
    await expect(saleListModel.list().rows().locator).toHaveCount(2)
  }).toPass()

  // Cancel subscription by product — should fail because there are two sales with the same product
  await cancelSubscription(page, url(), product1Number, customerEmail)

  // Verify the error page is shown with the multiple sales error message
  const cancelSubscriptionPage = createCancelSubscriptionPageModel(page)
  await expect(cancelSubscriptionPage.errorMessage().locator).toContainText(
    'Multiple subscriptions',
  )

  // unfortunately, need to wait some time because we're checking that something has NOT happened
  await page.waitForTimeout(1000)

  // Verify neither sale was cancelled — both should still show as active subscriptions
  await page.goto(new URL('/sales/1', url()).href)
  const sale1Model = createUpdateSalePageModel(page)
  await expect(sale1Model.saleStatus().locator).toHaveText(
    'Subscription | Connected to External Providers',
  )

  await page.goto(new URL('/sales/2', url()).href)
  const sale2Model = createUpdateSalePageModel(page)
  await expect(sale2Model.saleStatus().locator).toHaveText(
    'Subscription | Connected to External Providers',
  )
})
