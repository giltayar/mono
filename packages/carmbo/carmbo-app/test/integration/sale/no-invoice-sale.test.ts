import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudentListPageModel} from '../../page-model/students/student-list-page.model.ts'
import {createSaleListPageModel} from '../../page-model/sales/sale-list-page.model.ts'
import {createUpdateStudentPageModel} from '../../page-model/students/update-student-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {createSaleProvidersPageModel} from '../../page-model/sales/sale-providers-page.model.ts'
import {addQueryParamsToUrl} from '@giltayar/url-commons'
import {fetchAsText} from '@giltayar/http-commons'
import {createStudent} from '../../../src/domain/student/model.ts'
const {url, sql, smooveIntegration, academyIntegration} = setup(import.meta.url)

test.use({viewport: {width: 1280, height: 1280}})

test('no invoice sale creates student, sale, and integrations', async ({page}) => {
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
  const customerFirstName = 'John'
  const customerLastName = 'Doe'
  const customerPhone = '0501234567'

  await fetchAsText(
    addQueryParamsToUrl(new URL('/api/sales/no-invoice-sale', url()), {
      secret: 'secret',
      'sales-event': salesEventNumber.toString(),
      email: customerEmail,
      phone: customerPhone,
      firstName: customerFirstName,
      lastName: customerLastName,
    }),
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

  await expect(updateStudentModel.form().emails().emailInput(0).locator).toHaveValue(customerEmail)
  await expect(updateStudentModel.form().names().firstNameInput(0).locator).toHaveValue(
    customerFirstName,
  )
  await expect(updateStudentModel.form().names().lastNameInput(0).locator).toHaveValue(
    customerLastName,
  )
  await expect(updateStudentModel.form().phones().phoneInput(0).locator).toHaveValue(customerPhone)
  await expect(updateStudentModel.form().cardcomCustomerIdsInput().locator).not.toBeVisible()

  await page.goto(new URL('/sales', url()).href)

  const saleListModel = createSaleListPageModel(page)
  const saleRows = saleListModel.list().rows()

  await expect(saleRows.locator).toHaveCount(1)

  const firstSaleRow = saleRows.row(0)
  await expect(firstSaleRow.eventCell().locator).toHaveText('Test Sales Event')
  await expect(firstSaleRow.studentCell().locator).toHaveText('John Doe')
  await expect(firstSaleRow.revenueCell().locator).toContainText('-')
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
  expect(academyContact?.name).toBe(`${customerFirstName} ${customerLastName}`)
  expect(academyContact?.phone).toBe(customerPhone)
  expect(await academyIntegration().isStudentEnrolledInCourse(customerEmail, academyCourseId)).toBe(
    true,
  )

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
  await expect(saleDetailModel.form().finalSaleRevenueInput().locator).toHaveValue('0')

  await expect(saleDetailModel.form().viewInvoiceLink().locator).not.toBeVisible()

  // Verify that refund button is not visible for no-invoice sales
  await expect(saleDetailModel.form().refundButton().locator).not.toBeVisible()

  // Verify products in the sale detail page
  const products = saleDetailModel.form().products()
  await expect(products.locator).toHaveCount(2)

  const product1 = products.product(0)
  await expect(product1.title().locator).toContainText('Product One')
  await expect(product1.locator).toContainText(`${product1Number}: Product One`)
  await expect(product1.quantity().locator).toHaveValue('1')
  await expect(product1.unitPrice().locator).toHaveValue('0')

  const product2 = products.product(1)
  await expect(product2.title().locator).toContainText('Product Two')
  await expect(product2.quantity().locator).toHaveValue('1')
  await expect(product2.unitPrice().locator).toHaveValue('0')

  await expect(saleDetailModel.history().items().item(0).locator).toHaveText(/created/)

  // Navigate to the providers page to verify connections
  await page.goto(new URL('/sales/1/providers', url()).href)
  await page.waitForURL(/\/sales\/1\/providers$/)

  const providersPageModel = createSaleProvidersPageModel(page)

  // Verify page title
  await expect(providersPageModel.pageTitle().locator).toContainText('Sale 1')

  // Verify we have the expected product cards (2 products with integrations)
  const productCards = providersPageModel.productCards()
  await expect(productCards.locator).toHaveCount(2)

  // Check first product (Product One) - has academy course and smoove list
  const product1Card = productCards.card(0)
  await expect(product1Card.title().locator).toContainText('Product One')

  // Verify academy course connection
  const product1Academies = product1Card.academyCourses()
  await expect(product1Academies.courseCheckbox(academyCourseId.toString()).locator).toBeChecked()

  // Verify smoove list connections
  const product1Smoove = product1Card.smooveLists()
  await expect(product1Smoove.mainListCheckbox().locator).toBeChecked()
  await expect(product1Smoove.cancelledListCheckbox().locator).not.toBeChecked()
  await expect(product1Smoove.removedListCheckbox().locator).not.toBeChecked()

  // Check second product (Product Two) - has academy course
  const product2Card = productCards.card(1)
  await expect(product2Card.title().locator).toContainText('Product Two')

  // Verify academy course connection
  const product2Academies = product2Card.academyCourses()
  await expect(product2Academies.courseCheckbox('33').locator).toBeChecked()

  // Go back to sale detail page
  await page.goto(new URL('/sales/1', url()).href)
  await page.waitForURL(/\/sales\/1$/)

  const smooveId = (
    await smooveIntegration().fetchSmooveContact('test-customer@example.com', {by: 'email'})
  ).id!
  await smooveIntegration().changeContactLinkedLists(smooveId, {
    unsubscribeFrom: [smooveListId],
    subscribeTo: [],
  })
  expect(await smooveIntegration().fetchContactsOfList(2)).toEqual([])

  await academyIntegration().removeContactFromAccount('test-customer@example.com')
  expect(await academyIntegration().isStudentEnrolledInCourse('test-customer@example.com', 1)).toBe(
    false,
  )

  await saleDetailModel.form().reconnectButton().locator.click()

  await expect(saleDetailModel.history().items().locator).toHaveCount(3)

  // Verify sale details
  await expect(saleDetailModel.form().salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await expect(saleDetailModel.form().studentInput().locator).toHaveValue('1: John Doe')
  await expect(saleDetailModel.form().finalSaleRevenueInput().locator).toHaveValue('0')

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
  await expect(product1x.unitPrice().locator).toHaveValue('0')

  const product2x = productsX.product(1)
  await expect(product2x.title().locator).toContainText('Product Two')
  await expect(product2x.quantity().locator).toHaveValue('1')
  await expect(product2x.unitPrice().locator).toHaveValue('0')

  expect(await academyIntegration().isStudentEnrolledInCourse('test-customer@example.com', 1)).toBe(
    true,
  )
  expect(
    await academyIntegration().isStudentEnrolledInCourse('test-customer@example.com', 33),
  ).toBe(true)

  expect(
    (await smooveIntegration().fetchContactsOfList(2)).map((contact) => contact.email),
  ).toEqual(['test-customer@example.com'])
})

test('no invoice sale finds existing student', async ({page}) => {
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

  const customerEmail = 'repeat-customer@example.com'

  await createStudent(
    {emails: [customerEmail], names: [{firstName: 'Jane', lastName: 'Doe'}]},
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  // Verify first student was created
  await page.goto(new URL('/students', url()).href)
  const studentListModel = createStudentListPageModel(page)
  let studentRows = studentListModel.list().rows()
  await expect(studentRows.locator).toHaveCount(1)

  const firstStudent = studentRows.row(0)
  await expect(firstStudent.nameCell().locator).toHaveText('Jane Doe')
  await expect(firstStudent.emailCell().locator).toHaveText(customerEmail)

  await fetchAsText(
    addQueryParamsToUrl(new URL('/api/sales/no-invoice-sale', url()), {
      secret: 'secret',
      'sales-event': salesEventNumber.toString(),
      email: customerEmail,
    }),
  )

  // Verify still only 1 student (same student, different payment method)
  await page.goto(new URL('/students', url()).href)
  studentRows = studentListModel.list().rows()
  await expect(studentRows.locator).toHaveCount(1)
  await expect(studentRows.row(0).nameCell().locator).toHaveText('Jane Doe')

  // Verify sale exist
  await page.goto(new URL('/sales', url()).href)
  const saleListModel = createSaleListPageModel(page)
  const saleRows = saleListModel.list().rows()
  await expect(saleRows.locator).toHaveCount(1)

  // Sale should be linked to the same student
  await expect(saleRows.row(0).studentCell().locator).toHaveText('Jane Doe')
})

test('double call of webhook should create only one sale and one student', async ({page}) => {
  const academyCourseId = 1
  const smooveListId = 2

  const productNumber = await createProduct(
    {
      name: 'Test Product',
      productType: 'recorded',
      academyCourses: [academyCourseId],
      smooveListId: smooveListId,
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

  const customerEmail = 'duplicate-customer@example.com'
  const customerFirstName = 'Jane'
  const customerLastName = 'Smith'
  const customerPhone = '0507777777'

  // First call - should create student and sale
  await fetchAsText(
    addQueryParamsToUrl(new URL('/api/sales/no-invoice-sale', url()), {
      secret: 'secret',
      'sales-event': salesEventNumber.toString(),
      email: customerEmail,
      phone: customerPhone,
      firstName: customerFirstName,
      lastName: customerLastName,
    }),
  )

  // Second call with same data and same invoice number - should NOT create duplicates
  await fetchAsText(
    addQueryParamsToUrl(new URL('/api/sales/no-invoice-sale', url()), {
      secret: 'secret',
      'sales-event': salesEventNumber.toString(),
      email: customerEmail,
      phone: customerPhone,
      firstName: customerFirstName,
      lastName: customerLastName,
    }),
  )

  // Verify only one student was created
  await page.goto(new URL('/students', url()).href)
  const studentListModel = createStudentListPageModel(page)
  const studentRows = studentListModel.list().rows()

  await expect(studentRows.locator).toHaveCount(1)

  const firstStudentRow = studentRows.row(0)
  await expect(firstStudentRow.nameCell().locator).toHaveText('Jane Smith')

  // Verify only one sale was created
  await page.goto(new URL('/sales', url()).href)
  const saleListModel = createSaleListPageModel(page)
  const saleRows = saleListModel.list().rows()

  await expect(saleRows.locator).toHaveCount(1)

  const firstSaleRow = saleRows.row(0)
  await expect(firstSaleRow.eventCell().locator).toHaveText('Test Sales Event')
  await expect(firstSaleRow.studentCell().locator).toHaveText('Jane Smith')

  const smooveContacts = await smooveIntegration().fetchContactsOfList(smooveListId)
  expect(smooveContacts.length).toBe(1)
  expect(smooveContacts[0].email).toBe(customerEmail)
  expect(smooveContacts[0].firstName).toBe('Jane')
  expect(smooveContacts[0].lastName).toBe('Smith')
  expect(smooveContacts[0].telephone).toBe(customerPhone)

  const academyContact = academyIntegration()._test_getContact(customerEmail)
  expect(academyContact).toBeDefined()
  expect(academyContact?.name).toBe(`${customerFirstName} ${customerLastName}`)
  expect(academyContact?.phone).toBe(customerPhone)
  expect(await academyIntegration().isStudentEnrolledInCourse(customerEmail, academyCourseId)).toBe(
    true,
  )
})
