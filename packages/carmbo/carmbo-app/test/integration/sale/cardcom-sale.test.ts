import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {generateCardcomWebhookData} from '../../common/cardcom-simulation.ts'
import {createStudentListPageModel} from '../../page-model/students/student-list-page.model.ts'
import {createSaleListPageModel} from '../../page-model/sales/sale-list-page.model.ts'
import {createSaleDetailPageModel} from '../../page-model/sales/sale-detail-page.model.ts'
import {fetchAsTextWithJsonBody} from '@giltayar/http-commons'
import {addQueryParamsToUrl} from '@giltayar/url-commons'

const {url, sql, smooveIntegration, academyIntegration} = setup(import.meta.url)

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

  const webhookData = generateCardcomWebhookData(
    [
      {productId: product1Number, quantity: 1, price: 100},
      {productId: product2Number, quantity: 2, price: 50},
    ],
    {
      email: customerEmail,
      name: customerName,
      phone: customerPhone,
    },
  )

  const webhookUrl = addQueryParamsToUrl(new URL('/api/sales/cardcom/one-time-sale', url()), {
    secret: 'secret',
    'sales-event': salesEventNumber.toString(),
  })

  await fetchAsTextWithJsonBody(webhookUrl.toString(), webhookData as any)

  await page.goto(new URL('/students', url()).href)

  const studentListModel = createStudentListPageModel(page)
  const studentRows = studentListModel.list().rows()

  await expect(studentRows.locator).toHaveCount(1)

  const firstStudentRow = studentRows.row(0)
  await expect(firstStudentRow.nameCell().locator).toHaveText('John Doe')
  await expect(firstStudentRow.emailCell().locator).toHaveText(customerEmail)
  await expect(firstStudentRow.phoneCell().locator).toHaveText(customerPhone)

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
  await expect(saleDetailModel.saleNumberInput().locator).toHaveValue('1')
  await expect(saleDetailModel.salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await expect(saleDetailModel.studentInput().locator).toHaveValue('1: John Doe')
  await expect(saleDetailModel.finalSaleRevenueInput().locator).toHaveValue('₪200.00')

  // Verify products in the sale detail page
  const products = saleDetailModel.products()
  expect(await products.count()).toBe(2)

  const product1 = products.product(0)
  await expect(product1.title().locator).toContainText('Product One')
  await expect(product1.productNumber().locator).toContainText(`${product1Number}: Product One`)
  await expect(product1.quantity().locator).toHaveText('1')
  await expect(product1.unitPrice().locator).toHaveText('₪100.00')

  const product2 = products.product(1)
  await expect(product2.title().locator).toContainText('Product Two')
  await expect(product2.productNumber().locator).toContainText(`${product2Number}: Product Two`)
  await expect(product2.quantity().locator).toHaveText('2')
  await expect(product2.unitPrice().locator).toHaveText('₪50.00')
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
  const webhookUrl = addQueryParamsToUrl(new URL('/api/sales/cardcom/one-time-sale', url()), {
    secret: 'secret',
    'sales-event': salesEventNumber.toString(),
  })

  // First sale with email x and phone y
  const webhookDataA = generateCardcomWebhookData(
    [{productId: productNumber, quantity: 1, price: 100}],
    {
      email: 'customer-a@example.com',
      name: 'Alice Smith',
      phone: '0501111111',
      customerId,
    },
  )

  await fetchAsTextWithJsonBody(webhookUrl.toString(), webhookDataA as any)

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

  // Second sale with different email and phone but same customer ID
  const webhookDataB = generateCardcomWebhookData(
    [{productId: productNumber, quantity: 1, price: 100}],
    {
      email: 'customer-b@example.com',
      name: 'Bob Jones',
      phone: '0502222222',
      customerId,
    },
  )

  await fetchAsTextWithJsonBody(webhookUrl.toString(), webhookDataB as any)

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
})
