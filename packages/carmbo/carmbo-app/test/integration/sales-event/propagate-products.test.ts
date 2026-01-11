import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {createNewSalePageModel} from '../../page-model/sales/new-sale-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {createUpdateSalesEventPageModel} from '../../page-model/sales-events/update-sales-event-page.model.ts'

const {url, sql, smooveIntegration, academyIntegration} = setup(import.meta.url)

test('adding product to sales event enrolls students from connected sales', async ({page}) => {
  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const updateSalesEventModel = createUpdateSalesEventPageModel(page)

  // Setup: Create a student
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'John', lastName: 'Doe'}],
      emails: ['john.propagate@example.com'],
      phones: ['1234567890'],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  // Create Product 1 with Course 1
  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      academyCourses: [1],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create Product 2 with Course 33
  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'recorded',
      academyCourses: [33],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a sales event with only Product 1
  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/test',
      productsForSale: [product1Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a sale via UI
  await page.goto(new URL('/sales/new', url()).href)
  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.fill('100')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  // Connect the sale via UI (this enrolls student in Course 1)
  await updateSaleModel.form().connectButton().locator.click()
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Verify student is enrolled in Course 1 but not Course 33
  expect(
    await academyIntegration().isStudentEnrolledInCourse('john.propagate@example.com', 1),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('john.propagate@example.com', 33),
  ).toBe(false)

  // Navigate to the sales event page and add Product 2
  await page.goto(new URL(`/sales-events/${salesEventNumber}`, url()).href)
  await page.waitForURL(updateSalesEventModel.urlRegex)

  const updateForm = updateSalesEventModel.form()
  await updateForm.productsForSale().addButton().locator.click()
  await updateForm.productsForSale().productInput(1).locator.fill(`${product2Number}`)

  // Save the sales event update (this triggers propagation)
  await updateForm.updateButton().locator.click()

  // Wait for the update to complete by checking the form reflects the new values
  await expect(updateForm.productsForSale().productInput(1).locator).toHaveValue(
    new RegExp(`^${product2Number}:`),
  )

  // Verify student is now enrolled in both courses
  expect(
    await academyIntegration().isStudentEnrolledInCourse('john.propagate@example.com', 1),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('john.propagate@example.com', 33),
  ).toBe(true)
})

test('removing product from sales event does NOT unenroll students (they already purchased)', async ({
  page,
}) => {
  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const updateSalesEventModel = createUpdateSalesEventPageModel(page)

  // Setup: Create a student
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Jane', lastName: 'Doe'}],
      emails: ['jane.propagate@example.com'],
      phones: ['0987654321'],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  // Create Product 1 with Course 1
  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      academyCourses: [1],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create Product 2 with Course 33
  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'recorded',
      academyCourses: [33],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a sales event with both products
  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/test',
      productsForSale: [product1Number, product2Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a sale via UI
  await page.goto(new URL('/sales/new', url()).href)
  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.products().product(1).quantity().locator.fill('1')
  await newForm.products().product(1).unitPrice().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.fill('200')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  // Connect the sale via UI (this enrolls student in both courses)
  await updateSaleModel.form().connectButton().locator.click()
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Verify student is enrolled in both courses
  expect(
    await academyIntegration().isStudentEnrolledInCourse('jane.propagate@example.com', 1),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('jane.propagate@example.com', 33),
  ).toBe(true)

  // Navigate to the sales event page and remove Product 2
  await page.goto(new URL(`/sales-events/${salesEventNumber}`, url()).href)
  await page.waitForURL(updateSalesEventModel.urlRegex)

  const updateForm = updateSalesEventModel.form()
  // Remove the second product (Product 2)
  await updateForm.productsForSale().trashButton(1).locator.click()

  // Save the sales event update
  await updateForm.updateButton().locator.click()

  // Wait for the page refresh to complete after the update
  await page.waitForLoadState('networkidle')

  // Verify student is STILL enrolled in BOTH courses
  // We don't unenroll students when products are removed from sales event
  // because the student already purchased those products
  expect(
    await academyIntegration().isStudentEnrolledInCourse('jane.propagate@example.com', 1),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('jane.propagate@example.com', 33),
  ).toBe(true)
})

test('disconnected sales are not affected by sales event product updates', async ({page}) => {
  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const updateSalesEventModel = createUpdateSalesEventPageModel(page)

  // Setup: Create a student
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Alice', lastName: 'Wonder'}],
      emails: ['alice.propagate@example.com'],
      phones: ['1112223333'],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  // Create Product 1 with Course 1
  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      academyCourses: [1],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create Product 2 with Course 33
  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'recorded',
      academyCourses: [33],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a sales event with only Product 1
  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/test',
      productsForSale: [product1Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a sale via UI but DON'T connect it
  await page.goto(new URL('/sales/new', url()).href)
  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.fill('100')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  // DO NOT connect the sale - leave it disconnected
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Disconnected from External Providers',
  )

  // Verify student is NOT enrolled in any course (sale not connected)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('alice.propagate@example.com', 1),
  ).toBe(false)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('alice.propagate@example.com', 33),
  ).toBe(false)

  // Navigate to the sales event page and add Product 2
  await page.goto(new URL(`/sales-events/${salesEventNumber}`, url()).href)
  await page.waitForURL(updateSalesEventModel.urlRegex)

  const updateForm = updateSalesEventModel.form()
  await updateForm.productsForSale().addButton().locator.click()
  await updateForm.productsForSale().productInput(1).locator.fill(`${product2Number}`)

  // Save the sales event update
  await updateForm.updateButton().locator.click()

  // Wait for the update to complete by checking the form reflects the new values
  await expect(updateForm.productsForSale().productInput(1).locator).toHaveValue(
    new RegExp(`^${product2Number}:`),
  )

  // Verify student is STILL NOT enrolled in any course (sale was not connected)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('alice.propagate@example.com', 1),
  ).toBe(false)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('alice.propagate@example.com', 33),
  ).toBe(false)
})
