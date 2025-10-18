import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudentListPageModel} from '../../page-model/students/student-list-page.model.ts'
import {createSaleListPageModel} from '../../page-model/sales/sale-list-page.model.ts'
import {createSaleDetailPageModel} from '../../page-model/sales/sale-detail-page.model.ts'
import {createUpdateStudentPageModel} from '../../page-model/students/update-student-page.model.ts'
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
      cardcomCustomerId: undefined,
      transactionDate: new Date(),
      transactionDescription: '',
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
  // The Cardcom Customer IDs field should not be visible since no customer ID was provided
  await expect(updateStudentModel.form().cardcomCustomerIdsInput().locator).not.toBeVisible()

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

  const smooveContacts = await smooveIntegration().fetchContactsOfList(smooveListId)
  expect(smooveContacts.length).toBe(1)
  expect(smooveContacts[0].email).toBe(customerEmail)
  expect(smooveContacts[0].firstName).toBe('John')
  expect(smooveContacts[0].lastName).toBe('Doe')
  expect(smooveContacts[0].telephone).toBe(customerPhone)
  expect(smooveContacts[0].lists_Linked).toContain(smooveListId)

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

  const saleDetailModel = createSaleDetailPageModel(page)

  // Verify sale details
  await expect(saleDetailModel.form().salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await expect(saleDetailModel.form().studentInput().locator).toHaveValue('1: John Doe')
  await expect(saleDetailModel.form().finalSaleRevenueInput().locator).toHaveValue('21')

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
})

test('cardcom sale with same customer ID reuses existing student', async ({page}) => {
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

  const customerId = '12345'

  // First sale with email x and phone y
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
      customerEmail: 'customer-a@example.com',
      customerName: 'Alice Smith',
      customerPhone: '0501111111',
      cardcomCustomerId: parseInt(customerId),
      transactionDate: new Date(),
      transactionDescription: '',
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
  await expect(firstStudent.nameCell().locator).toHaveText('Alice Smith')
  await expect(firstStudent.emailCell().locator).toHaveText('customer-a@example.com')
  await expect(firstStudent.phoneCell().locator).toHaveText('0501111111')

  // Get the student number from the first student
  const studentNumberText = await firstStudent.idLink().locator.textContent()
  const studentNumber = studentNumberText?.trim()

  // Navigate to student detail page to verify Cardcom customer ID appears
  await firstStudent.idLink().locator.click()
  await page.waitForURL(/\/students\/\d+$/)

  const updateStudentModel = createUpdateStudentPageModel(page)
  await expect(updateStudentModel.form().cardcomCustomerIdsInput().locator).toBeVisible()
  await expect(updateStudentModel.form().cardcomCustomerIdsInput().locator).toHaveValue('12345')

  // Go back to students list
  await page.goto(new URL('/students', url()).href)

  // Second sale with different email and phone but same customer ID
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
      customerEmail: 'customer-b@example.com',
      customerName: 'Bob Jones',
      customerPhone: '0502222222',
      cardcomCustomerId: parseInt(customerId),
      transactionDate: new Date(),
      transactionDescription: '',
      transactionRevenueInCents: 100 * 100,
    },
    {
      secret: 'secret',
      baseUrl: url().href,
    },
  )

  // Verify no new student was created - still just 1 student
  await page.reload()
  studentRows = studentListModel.list().rows()
  await expect(studentRows.locator).toHaveCount(1)

  // Verify it's still the same student from sale A
  const onlyStudent = studentRows.row(0)
  await expect(onlyStudent.idLink().locator).toHaveText(studentNumber!)
  await expect(onlyStudent.nameCell().locator).toHaveText('Alice Smith')
  await expect(onlyStudent.emailCell().locator).toHaveText('customer-a@example.com')
  await expect(onlyStudent.phoneCell().locator).toHaveText('0501111111')

  // Verify both sales exist and are linked to the same student
  await page.goto(new URL('/sales', url()).href)
  const saleListModel = createSaleListPageModel(page)
  const saleRows = saleListModel.list().rows()
  await expect(saleRows.locator).toHaveCount(2)

  // Both sales should show the same student name (Alice Smith from the original student)
  await expect(saleRows.row(0).studentCell().locator).toHaveText('Alice Smith')
  await expect(saleRows.row(1).studentCell().locator).toHaveText('Alice Smith')

  // Navigate back to student detail page to verify customer ID still shows correctly
  await page.goto(new URL(`/students/${studentNumber}`, url()).href)
  await page.waitForURL(/\/students\/\d+$/)

  // The customer ID should still be "12345" (not duplicated)
  await expect(updateStudentModel.form().cardcomCustomerIdsInput().locator).toBeVisible()
  await expect(updateStudentModel.form().cardcomCustomerIdsInput().locator).toHaveValue('12345')
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
      transactionDescription: '',
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
      transactionDescription: '',
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
})
