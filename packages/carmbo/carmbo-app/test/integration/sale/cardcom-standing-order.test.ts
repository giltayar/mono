import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model/model.ts'
import {createStudentListPageModel} from '../../page-model/students/student-list-page.model.ts'
import {createSaleListPageModel} from '../../page-model/sales/sale-list-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {createSalePaymentsPageModel} from '../../page-model/sales/sale-payments-page.model.ts'
import {fetchAsTextWithJsonBody} from '@giltayar/http-commons'
import type {
  CardcomDetailRecurringJson,
  CardcomMasterRecurringJson,
} from '@giltayar/carmel-tools-cardcom-integration/types'
import {humanIsraeliPhoneNumberToWhatsAppId} from '@giltayar/carmel-tools-whatsapp-integration/utils'
import {cardcomRecurringPaymentWebhookUrl, cardcomWebhookUrl} from './common/cardcom-webhook.ts'
import {createJobListPageModel} from '../../page-model/jobs/job-list-page.model.ts'

const {
  url,
  sql,
  smooveIntegration,
  academyIntegration,
  cardcomIntegration,
  whatsappIntegration,
  skoolIntegration,
} = setup(import.meta.url)

test.use({viewport: {width: 1280, height: 1280}})

test('cardcom standing order creates student, sale with two payments', async ({page}) => {
  const academyCourseId = 1
  const smooveListId = 2

  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      academyCourses: [{courseId: academyCourseId, accountSubdomain: 'carmel'}],
      smooveListId: smooveListId,
      personalMessageWhenJoining: 'Welcome to Product One!',
      sendSkoolInvitation: true,
    },
    undefined,
    new Date(),
    sql(),
  )

  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'challenge',
      academyCourses: [{courseId: 100, accountSubdomain: 'inspiredlivingdaily'}],
      personalMessageWhenJoining: 'Welcome to Product Two!',
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

  const {recurringOrderId, cardcomInvoiceNumber} =
    await cardcomIntegration()._test_simulateCardcomStandingOrder(
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

  // Verify integrations were successful
  await expect(async () => {
    const smooveContacts = await smooveIntegration().fetchContactsOfList(smooveListId)
    expect(smooveContacts.length).toBe(1)
    expect(smooveContacts[0].email).toBe(customerEmail)
    expect(smooveContacts[0].firstName).toBe('John')
    expect(smooveContacts[0].lastName).toBe('Doe')
    expect(smooveContacts[0].telephone).toBe(customerPhone)
    expect(smooveContacts[0].lists_Linked).toContain(smooveListId)
  }).toPass()

  const academyContact = academyIntegration()._test_getContact(customerEmail, 'carmel')
  expect(academyContact).toBeDefined()
  expect(academyContact?.name).toBe(customerName)
  expect(academyContact?.phone).toBe(customerPhone)
  expect(
    await academyIntegration().isStudentEnrolledInCourse(customerEmail, academyCourseId, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)

  const academyContactId = academyIntegration()._test_getContact(
    customerEmail,
    'inspiredlivingdaily',
  )
  expect(academyContactId).toBeDefined()
  expect(academyContactId?.name).toBe(customerName)
  expect(academyContactId?.phone).toBe(customerPhone)
  expect(
    await academyIntegration().isStudentEnrolledInCourse(customerEmail, 100, {
      accountSubdomain: 'inspiredlivingdaily',
    }),
  ).toBe(true)

  // Verify personal messages were sent
  await expect(async () => {
    const contactId = humanIsraeliPhoneNumberToWhatsAppId(customerPhone)
    const sentMessages = whatsappIntegration()._test_sentContactMessages(contactId)
    expect(sentMessages).toContain('Welcome to Product One!')
    expect(sentMessages).toContain('Welcome to Product Two!')
  }).toPass()

  // Verify skool invitation was sent
  await expect(async () => {
    expect(skoolIntegration()._test_isInviteSentForEmail(customerEmail)).toBe(true)
  }).toPass()

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
  await expect(firstPayment.invoiceNumberCell().locator).toContainText(`${cardcomInvoiceNumber}`)

  // Navigate to jobs page and verify the direct job was created
  await page.goto(new URL('/jobs', url()).href)

  const jobListModel = createJobListPageModel(page)
  const jobRows = jobListModel.list().rows()

  await expect(jobRows.locator).toHaveCount(4)

  const firstJobRow = jobRows.row(3)
  await expect(firstJobRow.descriptionCell().locator).not.toBeEmpty()
  await expect(firstJobRow.statusCell().locator).toContainText('✔')
  await expect(firstJobRow.descriptionCell().locator).toContainText(
    `Processing Cardcom sale for sales event ${salesEventNumber}, invoice ${cardcomInvoiceNumber}, email ${customerEmail}`,
  )

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
  await page.goto(new URL('/sales/1/payments', url()).href)
  await page.waitForURL(/\/sales\/\d+\/payments$/)

  // Verify there are now two payments
  await expect(paymentRows.locator).toHaveCount(2)

  // Verify the second payment details
  const secondPayment = paymentRows.row(1)
  await expect(secondPayment.amountCell().locator).toContainText('200')
  await expect(secondPayment.resolutionCell().locator).toContainText('payed')
})

test('cardcom standing order with no product id shows error in jobs page', async ({page}) => {
  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      academyCourses: [{courseId: 1, accountSubdomain: 'carmel'}],
      personalMessageWhenJoining: 'Welcome!',
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

  await expect(() =>
    cardcomIntegration()._test_simulateCardcomStandingOrder(
      {
        productsSold: [
          {
            productId: '',
            quantity: 1,
            unitPriceInCents: 100 * 100,
            productName: 'Product One',
          },
        ],
        customerEmail: 'test-customer@example.com',
        customerName: 'John Doe',
        customerPhone: '0501234567',
        cardcomCustomerId: 1776,
        transactionDate: new Date(),
        transactionDescription: undefined,
        transactionRevenueInCents: 100 * 100,
      },
      undefined,
      cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
      cardcomRecurringPaymentWebhookUrl(url(), 'secret'),
    ),
  ).rejects.toThrow()

  await page.goto(new URL('/jobs', url()).href)

  const jobListModel = createJobListPageModel(page)
  const jobRows = jobListModel.list().rows()

  await expect(jobRows.locator).toHaveCount(1)

  const firstJobRow = jobRows.row(0)
  await expect(firstJobRow.statusCell().locator).toContainText('❌')
  await expect(firstJobRow.statusCell().locator).toContainText(
    'You forgot to enter the Carmbo Product Id in the Product information in the Cardcom landing page',
  )
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
