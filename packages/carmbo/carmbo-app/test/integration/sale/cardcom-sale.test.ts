import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudentListPageModel} from '../../page-model/students/student-list-page.model.ts'
import {createSaleListPageModel} from '../../page-model/sales/sale-list-page.model.ts'
import {createUpdateStudentPageModel} from '../../page-model/students/update-student-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import type {TaxInvoiceInformation} from '@giltayar/carmel-tools-cardcom-integration/service'
const {url, sql, smooveIntegration, academyIntegration, cardcomIntegration} = setup(import.meta.url)

test('cardcom sale creates student, sale, and integrations', async ({page}) => {
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

  const product3Number = await createProduct(
    {
      name: 'Product Three',
      productType: 'club',
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
      productsForSale: [product1Number, product2Number, product3Number],
    },
    undefined,
    sql(),
  )

  const customerEmail = 'test-customer@example.com'
  const customerName = 'John Doe'
  const customerPhone = '0501234567'

  await cardcomIntegration()._test_simulateCardcomSale(
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
      transactionRevenueInCents: 21 * 100,
    },
    {
      secret: 'secret',
      baseUrl: url().href,
    },
  )

  await page.goto(new URL('/students', url()).href)

  const studentListModel = createStudentListPageModel(page)
  const studentRows = studentListModel.list().rows()

  await expect(studentRows.locator).toHaveCount(1)

  const firstStudentRow = studentRows.row(0)
  await expect(firstStudentRow.nameCell().locator).toHaveText('John Doe')
  await expect(firstStudentRow.emailCell().locator).toHaveText(customerEmail)
  await expect(firstStudentRow.phoneCell().locator).toHaveText(customerPhone)

  // Navigate to student detail page to verify no Cardcom customer ID field (since none was provided)
  await firstStudentRow.idLink().locator.click()
  await page.waitForURL(/\/students\/\d+$/)

  const updateStudentModel = createUpdateStudentPageModel(page)

  await expect(updateStudentModel.form().cardcomCustomerIdsInput().locator).toHaveValue('1776')

  await page.goto(new URL('/sales', url()).href)

  const saleListModel = createSaleListPageModel(page)
  const saleRows = saleListModel.list().rows()

  await expect(saleRows.locator).toHaveCount(1)

  const firstSaleRow = saleRows.row(0)
  await expect(firstSaleRow.eventCell().locator).toHaveText('Test Sales Event')
  await expect(firstSaleRow.studentCell().locator).toHaveText('John Doe')
  await expect(firstSaleRow.revenueCell().locator).toContainText('21')
  await expect(firstSaleRow.productsCell().locator).toContainText('Product One')
  await expect(firstSaleRow.productsCell().locator).toContainText('Product Two')

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

  const taxInvoiceDocument = await cardcomIntegration()._test_getTaxInvoiceDocument('1')

  expect(taxInvoiceDocument).toBeDefined()

  await expect(taxInvoiceDocument).toMatchObject({
    customerName: 'John Doe',
    customerEmail: 'test-customer@example.com',
    customerPhone: '0501234567',
    productsSold: [
      {
        productId: product1Number.toString(),
        productName: 'Product One',
        quantity: 1,
        unitPriceInCents: 10000,
      },
      {
        productId: product2Number.toString(),
        productName: 'Product Two',
        quantity: 2,
        unitPriceInCents: 5000,
      },
    ],
    transactionRevenueInCents: 2100,
  } as Omit<TaxInvoiceInformation, 'transactionDate'>)

  // Click on the sale to view the sale detail page
  await firstSaleRow.idLink().locator.click()
  await page.waitForURL(/\/sales\/\d+$/)

  const saleDetailModel = createUpdateSalePageModel(page)

  await expect(saleDetailModel.pageTitle().locator).toHaveText('Sale 1')
  await expect(saleDetailModel.form().reconnectButton().locator).toBeVisible()
  await expect(saleDetailModel.form().connectButton().locator).not.toBeVisible()
  await expect(saleDetailModel.form().restoreButton().locator).not.toBeVisible()
  await expect(saleDetailModel.form().deleteButton().locator).not.toBeVisible()
  await expect(saleDetailModel.form().discardButton().locator).not.toBeVisible()

  // Verify sale details
  await expect(saleDetailModel.form().salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await expect(saleDetailModel.form().studentInput().locator).toHaveValue('1: John Doe')
  await expect(saleDetailModel.form().finalSaleRevenueInput().locator).toHaveValue('21')

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

  await expect(saleDetailModel.history().items().item(0).locator).toHaveText(/created/)

  const smooveId = (
    await smooveIntegration().fetchSmooveContact('test-customer@example.com', {by: 'email'})
  ).id!
  await smooveIntegration().changeContactLinkedLists(smooveId, {
    unsubscribeFrom: [smooveListId],
    subscribeTo: [],
  })
  expect(await smooveIntegration().fetchContactsOfList(2)).toEqual([])

  await academyIntegration().removeContactFromAccount('test-customer@example.com')
  expect(
    await academyIntegration()._test_isContactEnrolledInCourse('test-customer@example.com', 1),
  ).toBe(false)

  await saleDetailModel.form().reconnectButton().locator.click()

  await expect(saleDetailModel.history().items().locator).toHaveCount(3)

  // Verify sale details
  await expect(saleDetailModel.form().salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await expect(saleDetailModel.form().studentInput().locator).toHaveValue('1: John Doe')
  await expect(saleDetailModel.form().finalSaleRevenueInput().locator).toHaveValue('21')

  await expect(saleDetailModel.form().cardcomInvoiceNumberInput().locator).toHaveValue('1')
  await expect(saleDetailModel.form().viewInvoiceLink().locator).toHaveAttribute(
    'href',
    'http://invoice-document.example.com/1',
  )

  // Verify products in the sale detail page
  const productsX = saleDetailModel.form().products()
  await expect(productsX.locator).toHaveCount(2)

  const product1x = productsX.product(0)
  await expect(product1x.title().locator).toContainText('Product One')
  await expect(product1x.locator).toContainText(`${product1Number}: Product One`)
  await expect(product1x.quantity().locator).toHaveValue('1')
  await expect(product1x.unitPrice().locator).toHaveValue('100')

  const product2x = productsX.product(1)
  await expect(product2x.title().locator).toContainText('Product Two')
  await expect(product2x.quantity().locator).toHaveValue('2')
  await expect(product2x.unitPrice().locator).toHaveValue('50')

  expect(academyIntegration()._test_isContactEnrolledInCourse('test-customer@example.com', 1)).toBe(
    true,
  )
  expect(
    academyIntegration()._test_isContactEnrolledInCourse('test-customer@example.com', 33),
  ).toBe(true)

  expect(
    (await smooveIntegration().fetchContactsOfList(2)).map((contact) => contact.email),
  ).toEqual(['test-customer@example.com'])

  await page.goto(new URL(`/students/1`, url()).href)

  await expect(updateStudentModel.pageTitle().locator).toHaveText(`Update Student 1`)

  const studentForm = updateStudentModel.form()
  await expect(studentForm.cardcomCustomerIdsInput().locator).toHaveValue('1776')
})

test('student with multiple sales shows all different cardcom customer IDs', async ({page}) => {
  // Create a simple product
  const productNumber = await createProduct(
    {
      name: 'Test Product',
      productType: 'recorded',
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
      productsForSale: [productNumber],
    },
    undefined,
    sql(),
  )

  const customerEmail = 'repeat-customer@example.com'
  const customerName = 'Jane Doe'
  const _customerPhone = '0503333333'

  // First sale with customer ID "11111"
  await cardcomIntegration()._test_simulateCardcomSale(
    salesEventNumber,
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
      customerPhone: '0503333333',
      cardcomCustomerId: 11111,
      transactionDate: new Date(),
      transactionRevenueInCents: 100 * 100,
    },
    {
      secret: 'secret',
      baseUrl: url().href,
    },
  )

  // Verify first student was created
  await page.goto(new URL('/students', url()).href)
  const studentListModel = createStudentListPageModel(page)
  let studentRows = studentListModel.list().rows()
  await expect(studentRows.locator).toHaveCount(1)

  const firstStudent = studentRows.row(0)
  await expect(firstStudent.nameCell().locator).toHaveText('Jane Doe')
  await expect(firstStudent.emailCell().locator).toHaveText(customerEmail)

  // Get the student number
  const studentNumberText = await firstStudent.idLink().locator.textContent()
  const studentNumber = studentNumberText?.trim()

  // Navigate to student detail page to verify first customer ID
  await firstStudent.idLink().locator.click()
  await page.waitForURL(/\/students\/\d+$/)

  const updateStudentModel = createUpdateStudentPageModel(page)
  await expect(updateStudentModel.form().cardcomCustomerIdsInput().locator).toBeVisible()
  await expect(updateStudentModel.form().cardcomCustomerIdsInput().locator).toHaveValue('11111')

  // Second sale with same email/phone but different customer ID "22222"
  await cardcomIntegration()._test_simulateCardcomSale(
    salesEventNumber,
    {
      productsSold: [
        {
          productId: productNumber.toString(),
          quantity: 1,
          unitPriceInCents: 150 * 100,
          productName: 'Test Product',
        },
      ],
      customerEmail,
      customerName,
      customerPhone: '0503333334',
      cardcomCustomerId: 22222,
      transactionDate: new Date(),
      transactionRevenueInCents: 100 * 100,
    },
    {
      secret: 'secret',
      baseUrl: url().href,
    },
  )

  // Verify still only 1 student (same student, different payment method)
  await page.goto(new URL('/students', url()).href)
  studentRows = studentListModel.list().rows()
  await expect(studentRows.locator).toHaveCount(1)

  // Verify both sales exist
  await page.goto(new URL('/sales', url()).href)
  const saleListModel = createSaleListPageModel(page)
  const saleRows = saleListModel.list().rows()
  await expect(saleRows.locator).toHaveCount(2)

  // Both sales should be linked to the same student
  await expect(saleRows.row(0).studentCell().locator).toHaveText('Jane Doe')
  await expect(saleRows.row(1).studentCell().locator).toHaveText('Jane Doe')

  // Navigate to student detail page to verify both customer IDs appear
  await page.goto(new URL(`/students/${studentNumber}`, url()).href)
  await page.waitForURL(/\/students\/\d+$/)

  // Both customer IDs should appear, comma-separated (order: 11111, 22222 due to ORDER BY)
  await expect(updateStudentModel.form().cardcomCustomerIdsInput().locator).toBeVisible()
  await expect(updateStudentModel.form().cardcomCustomerIdsInput().locator).toHaveValue(
    '11111, 22222',
  )

  // update student model
  await updateStudentModel.form().updateButton().locator.click()

  await expect(updateStudentModel.history().items().item(0).locator).toHaveText(/updated/)
})
