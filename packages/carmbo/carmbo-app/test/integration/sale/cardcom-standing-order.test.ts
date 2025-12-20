import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudentListPageModel} from '../../page-model/students/student-list-page.model.ts'
import {createSaleListPageModel} from '../../page-model/sales/sale-list-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {createSalePaymentsPageModel} from '../../page-model/sales/sale-payments-page.model.ts'
import {createSaleProvidersPageModel} from '../../page-model/sales/sale-providers-page.model.ts'
import {fetchAsBuffer, fetchAsTextWithJsonBody} from '@giltayar/http-commons'
import type {
  CardcomDetailRecurringJson,
  CardcomMasterRecurringJson,
} from '@giltayar/carmel-tools-cardcom-integration/types'
import {humanIsraeliPhoneNumberToWhatsAppId} from '@giltayar/carmel-tools-whatsapp-integration/utils'
import {cardcomRecurringPaymentWebhookUrl, cardcomWebhookUrl} from './common/cardcom-webhook.ts'

const {
  url,
  sql,
  smooveIntegration,
  academyIntegration,
  cardcomIntegration,
  whatsappIntegration,
  setTime,
} = setup(import.meta.url)

test.use({viewport: {width: 1280, height: 1280}})

test('cardcom standing order creates student, sale with one payment', async ({page}) => {
  const academyCourseId = 1
  const smooveListId = 2

  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      academyCourses: [academyCourseId],
      smooveListId: smooveListId,
    },
    undefined,
    new Date(),
    sql(),
  )

  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'challenge',
      academyCourses: [33],
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

  const academyContact = academyIntegration()._test_getContact(customerEmail)
  expect(academyContact).toBeDefined()
  expect(academyContact?.name).toBe(customerName)
  expect(academyContact?.phone).toBe(customerPhone)
  expect(await academyIntegration().isStudentEnrolledInCourse(customerEmail, academyCourseId)).toBe(
    true,
  )

  // Click on the sale to view the sale detail page
  await firstSaleRow.idLink().locator.click()
  await page.waitForURL(/\/sales\/\d+$/)

  const saleDetailModel = createUpdateSalePageModel(page)

  await expect(saleDetailModel.pageTitle().locator).toHaveText('Sale 1')

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

test('cancelling a standing order subscription removes student from academy courses and updates smoove lists after the subscription ends', async ({
  page,
}) => {
  const academyCourseId = 1
  const smooveListId = 2
  const smooveCancellingListId = 4
  const smooveCancelledListId = 6
  const smooveRemovedListId = 8

  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      academyCourses: [academyCourseId],
      smooveListId,
      smooveCancelledListId,
      smooveCancellingListId,
      smooveRemovedListId,
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
      transactionRevenueInCents: 100 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
    cardcomRecurringPaymentWebhookUrl(url(), 'secret'),
  )

  // Verify student was enrolled in academy course
  await expect(async () => {
    const academyContact = academyIntegration()._test_getContact(customerEmail)
    expect(academyContact).toBeDefined()
    expect(
      await academyIntegration().isStudentEnrolledInCourse(customerEmail, academyCourseId),
    ).toBe(true)
  }).toPass()

  // Verify student was subscribed to smoove list
  await expect(async () => {
    const smooveContacts = await smooveIntegration().fetchContactsOfList(smooveListId)
    expect(smooveContacts.length).toBe(1)
    expect(smooveContacts[0].email).toBe(customerEmail)
    expect(smooveContacts[0].lists_Linked).toContain(smooveListId)
  }).toPass()

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
  await expect(providersPageModel.pageTitle().locator).toContainText('Sale 1')

  const productCards = providersPageModel.productCards()
  await expect(productCards.locator).toHaveCount(1)

  const productCard = productCards.card(0)
  await expect(productCard.title().locator).toContainText('Product One')

  // Verify academy course is connected
  const academyCourses = productCard.academyCourses()
  await expect(academyCourses.courseCheckbox(academyCourseId.toString()).locator).toBeChecked()
  await expect(academyCourses.courseName(academyCourseId.toString()).locator).toHaveText(
    '1: Course 1',
  )

  // Verify smoove main list is connected
  const smooveLists = productCard.smooveLists()
  await expect(smooveLists.mainListCheckbox().locator).toBeChecked()
  await expect(smooveLists.mainListName().locator).toHaveText('Main list (Smoove List ID 1)')
  await expect(smooveLists.cancelledListCheckbox().locator).not.toBeChecked()
  await expect(smooveLists.cancelledListName().locator).toHaveText(
    'Cancelled list (Smoove List Cancelled 3)',
  )
  await expect(smooveLists.removedListCheckbox().locator).not.toBeChecked()
  await expect(smooveLists.removedListName().locator).toHaveText(
    'Removed list (Smoove List Removed 4)',
  )

  // Verify whatsapp groups are connected
  const whatsappGroups = productCard.whatsAppGroups()
  await expect(whatsappGroups.groupCheckbox('1@g.us').locator).toBeChecked()
  await expect(whatsappGroups.groupName('1@g.us').locator).toHaveText('1@g.us: Test Group 1')
  await expect(whatsappGroups.groupCheckbox('3@g.us').locator).toBeChecked()
  await expect(whatsappGroups.groupName('3@g.us').locator).toHaveText('3@g.us: Test Group 3')

  // Cancel the subscription via the API endpoint
  await page.goto(
    new URL(
      `/landing-page/sales/cancel-subscription?sales-event=${salesEventNumber}&email=${encodeURIComponent(customerEmail)}`,
      url(),
    ).href,
  )
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

  // Verify student was NOT removed from academy course
  expect(await academyIntegration().isStudentEnrolledInCourse(customerEmail, academyCourseId)).toBe(
    true,
  )

  // Verify smoove lists were updated according to unsubscribeStudentFromSmooveLists
  await expect(async () => {
    const smooveContacts = await smooveIntegration().fetchContactsOfList(smooveListId)
    expect(smooveContacts.length).toBe(0)

    const cancelledContacts = await smooveIntegration().fetchContactsOfList(smooveCancelledListId)
    expect(cancelledContacts.length).toBe(1)
    expect(cancelledContacts[0].email).toBe(customerEmail)
    expect(cancelledContacts[0].lists_Linked).toContain(smooveCancelledListId)
  }).toPass()

  // Verify student was NOT removed from whatsapp groups yet
  expect(await whatsappIntegration()._test_listParticipantsInGroup('1@g.us')).toContain(
    humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
  )
  expect(await whatsappIntegration()._test_listParticipantsInGroup('3@g.us')).toContain(
    humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
  )

  // Verify providers page shows cancelled list is now connected
  await page.goto(new URL('/sales/1/providers', url()).href)
  await page.waitForURL(/\/sales\/1\/providers$/)

  const providersPageModel2 = createSaleProvidersPageModel(page)
  const productCards2 = providersPageModel2.productCards()
  const productCard2 = productCards2.card(0)

  // Academy course should still be connected
  const academyCourses2 = productCard2.academyCourses()
  await expect(academyCourses2.courseCheckbox(academyCourseId.toString()).locator).toBeChecked()

  // Smoove cancelled list should now be connected
  const smooveLists2 = productCard2.smooveLists()
  await expect(smooveLists2.mainListCheckbox().locator).not.toBeChecked()
  await expect(smooveLists2.cancelledListCheckbox().locator).toBeChecked()
  await expect(smooveLists2.removedListCheckbox().locator).not.toBeChecked()

  // WhatsApp groups should still be connected
  const whatsappGroups2 = productCard2.whatsAppGroups()
  await expect(whatsappGroups2.groupCheckbox('1@g.us').locator).toBeChecked()
  await expect(whatsappGroups2.groupCheckbox('3@g.us').locator).toBeChecked()

  setTime(new Date(Date.now() + 2 * 7 * 24 * 60 * 60 * 1000)) // Advance time by 2 weeks

  await fetchAsBuffer(new URL('/api/jobs/trigger-job-execution?secret=', url()), {method: 'POST'})

  // Verify student was STILL not removed from academy course
  expect(await academyIntegration().isStudentEnrolledInCourse(customerEmail, academyCourseId)).toBe(
    true,
  )

  // Verify smoove lists were STILL the same
  await expect(async () => {
    const smooveContacts = await smooveIntegration().fetchContactsOfList(smooveListId)
    expect(smooveContacts.length).toBe(0)

    const cancelledContacts = await smooveIntegration().fetchContactsOfList(smooveCancelledListId)
    expect(cancelledContacts.length).toBe(1)
  }).toPass()

  // Verify student was NOT removed from whatsapp groups yet
  expect(await whatsappIntegration()._test_listParticipantsInGroup('1@g.us')).toContain(
    humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
  )
  expect(await whatsappIntegration()._test_listParticipantsInGroup('3@g.us')).toContain(
    humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
  )

  setTime(new Date(Date.now() + 5 * 7 * 24 * 60 * 60 * 1000)) // Advance time by 5 weeks

  await fetchAsBuffer(new URL('/api/jobs/trigger-job-execution?secret=', url()), {method: 'POST'})

  await expect
    .poll(async () =>
      // Verify student WAS removed from academy course
      academyIntegration().isStudentEnrolledInCourse(customerEmail, academyCourseId),
    )
    .toBe(false)

  // Verify smoove lists were updated according to unsubscribeStudentFromSmooveLists
  const smooveContacts1 = await smooveIntegration().fetchContactsOfList(smooveListId)
  // Student should no longer be in the main list
  expect(smooveContacts1.length).toBe(0)
  const smooveContacts2 = await smooveIntegration().fetchContactsOfList(smooveCancelledListId)
  expect(smooveContacts2.length).toBe(0)
  // Student should be in the removed list`
  const cancelledContacts = await smooveIntegration().fetchContactsOfList(smooveRemovedListId)
  expect(cancelledContacts.length).toBe(1)
  expect(cancelledContacts[0].email).toBe(customerEmail)
  expect(cancelledContacts[0].lists_Linked).toContain(smooveRemovedListId)

  // Verify student WAS removed from whatsapp groups yet
  expect(await whatsappIntegration()._test_listParticipantsInGroup('1@g.us')).not.toContain(
    humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
  )
  expect(await whatsappIntegration()._test_listParticipantsInGroup('3@g.us')).not.toContain(
    humanIsraeliPhoneNumberToWhatsAppId(customerPhone),
  )

  // Verify providers page shows everything is disconnected and moved to removed list
  await page.goto(new URL('/sales/1/providers', url()).href)
  await page.waitForURL(/\/sales\/1\/providers$/)

  const providersPageModel3 = createSaleProvidersPageModel(page)
  const productCards3 = providersPageModel3.productCards()
  const productCard3 = productCards3.card(0)

  // Academy course should now be disconnected
  const academyCourses3 = productCard3.academyCourses()
  await expect(academyCourses3.courseCheckbox(academyCourseId.toString()).locator).not.toBeChecked()

  // Smoove removed list should now be connected
  const smooveLists3 = productCard3.smooveLists()
  await expect(smooveLists3.mainListCheckbox().locator).not.toBeChecked()
  await expect(smooveLists3.cancelledListCheckbox().locator).not.toBeChecked()
  await expect(smooveLists3.removedListCheckbox().locator).toBeChecked()

  // WhatsApp groups should be disconnected
  const whatsappGroups3 = productCard3.whatsAppGroups()
  await expect(whatsappGroups3.groupCheckbox('1@g.us').locator).not.toBeChecked()
  await expect(whatsappGroups3.groupCheckbox('3@g.us').locator).not.toBeChecked()

  await page.goto(new URL('/sales/1', url()).href)
  await page.reload()

  await expect(saleHistory.items().locator).toHaveCount(3)
  await expect(saleHistory.items().item(0).locator).toContainText('removed from subscription')
  await expect(saleHistory.items().item(1).locator).toContainText('canceled subscription')
  await expect(saleHistory.items().item(2).locator).toContainText('created')
})
