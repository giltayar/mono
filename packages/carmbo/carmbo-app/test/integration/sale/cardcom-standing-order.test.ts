import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudentListPageModel} from '../../page-model/students/student-list-page.model.ts'
import {createSaleListPageModel} from '../../page-model/sales/sale-list-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {createSalePaymentsPageModel} from '../../page-model/sales/sale-payments-page.model.ts'

const {url, sql, smooveIntegration, academyIntegration, cardcomIntegration} = setup(import.meta.url)

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
    sql(),
  )

  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'challenge',
      academyCourses: [33],
    },
    undefined,
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
    sql(),
  )

  const customerEmail = 'test-customer@example.com'
  const customerName = 'John Doe'
  const customerPhone = '0501234567'

  const {recurringOrderId} = await cardcomIntegration()._test_simulateCardcomStandingOrder(
    salesEventNumber,
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
    {
      secret: 'secret',
      baseUrl: url().href,
    },
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
  expect(academyIntegration()._test_isContactEnrolledInCourse(customerEmail, academyCourseId)).toBe(
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
    {
      secret: 'secret',
      baseUrl: url().href,
    },
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
