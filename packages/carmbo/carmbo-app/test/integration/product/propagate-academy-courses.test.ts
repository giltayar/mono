import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {createNewSalePageModel} from '../../page-model/sales/new-sale-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {createUpdateProductPageModel} from '../../page-model/products/update-product-page.model.ts'

const {url, sql, smooveIntegration, academyIntegration} = setup(import.meta.url)

test('updating product to add academy course enrolls students from connected sales', async ({
  page,
}) => {
  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

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

  // Create a product with one academy course
  const productNumber = await createProduct(
    {
      name: 'Test Product',
      productType: 'recorded',
      academyCourses: [1], // Course 1
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a sales event with this product
  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/test',
      productsForSale: [productNumber],
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
  await expect(newForm.salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await Promise.all([
    newForm.studentInput().locator.fill(`${studentNumber}`),
    page.waitForLoadState('networkidle'),
  ])
  await newForm.studentInput().locator.blur()
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)
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

  // Verify student is enrolled in Course 1
  expect(
    await academyIntegration().isStudentEnrolledInCourse('john.propagate@example.com', 1),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('john.propagate@example.com', 33),
  ).toBe(false)

  // Navigate to the product page and update it to add Course 33
  await page.goto(new URL(`/products/${productNumber}`, url()).href)
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  await updateForm.academyCourses().addButton().locator.click()
  await updateForm.academyCourses().academyCourseInput(1).locator.fill('33')

  // Save the product update (this triggers propagation)
  await updateForm.updateButton().locator.click()

  // Wait for the update to complete by checking the form reflects the new values
  await expect(updateForm.academyCourses().academyCourseInput(1).locator).toHaveValue(/^33:/)

  // Verify student is now enrolled in both courses
  expect(
    await academyIntegration().isStudentEnrolledInCourse('john.propagate@example.com', 1),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('john.propagate@example.com', 33),
  ).toBe(true)
})

test('updating product to remove academy course unenrolls students from connected sales', async ({
  page,
}) => {
  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

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

  // Create a product with two academy courses
  const productNumber = await createProduct(
    {
      name: 'Test Product',
      productType: 'recorded',
      academyCourses: [1, 33], // Course 1 and 33
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a sales event with this product
  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/test',
      productsForSale: [productNumber],
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
  await Promise.all([
    newForm.studentInput().locator.fill(`${studentNumber}`),
    page.waitForLoadState('networkidle'),
  ])
  await newForm.studentInput().locator.blur()
  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.fill('100')

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

  // Navigate to the product page and update it to remove Course 33
  await page.goto(new URL(`/products/${productNumber}`, url()).href)
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  // Remove the second course (Course 33) by clicking the trash button
  await updateForm.academyCourses().trashButton(1).locator.click()

  // Save the product update (this triggers propagation)
  await updateForm.updateButton().locator.click()

  // Wait for the page refresh to complete after the update
  await page.waitForLoadState('networkidle')

  // Verify student is still enrolled in Course 1 but not Course 33
  expect(
    await academyIntegration().isStudentEnrolledInCourse('jane.propagate@example.com', 1),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('jane.propagate@example.com', 33),
  ).toBe(false)
})

test('removing course from product does NOT unenroll if another product in same sale has that course', async ({
  page,
}) => {
  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  // Setup: Create a student
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Bob', lastName: 'Smith'}],
      emails: ['bob.propagate@example.com'],
      phones: ['5555555555'],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  // Create product 1 with Course 1 and Course 33
  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      academyCourses: [1, 33],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create product 2 with Course 33 (shared with product 1)
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

  // Create a sale with BOTH products via UI
  await page.goto(new URL('/sales/new', url()).href)
  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await Promise.all([
    newForm.studentInput().locator.fill(`${studentNumber}`),
    page.waitForLoadState('networkidle'),
  ])
  await newForm.studentInput().locator.blur()
  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.products().product(1).quantity().locator.fill('1')
  await newForm.products().product(1).unitPrice().locator.fill('50')
  await newForm.finalSaleRevenueInput().locator.fill('150')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  // Connect the sale via UI
  await updateSaleModel.form().connectButton().locator.click()
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Verify student is enrolled in both courses
  expect(await academyIntegration().isStudentEnrolledInCourse('bob.propagate@example.com', 1)).toBe(
    true,
  )
  expect(
    await academyIntegration().isStudentEnrolledInCourse('bob.propagate@example.com', 33),
  ).toBe(true)

  // Navigate to product 1 page and update it to remove Course 33 (but product 2 still has it)
  await page.goto(new URL(`/products/${product1Number}`, url()).href)
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  // Remove the second course (Course 33) by clicking the trash button
  await updateForm.academyCourses().trashButton(1).locator.click()

  // Save the product update (this triggers propagation)
  await updateForm.updateButton().locator.click()

  // Wait for the update to complete by checking that only one academy course input remains
  await expect(updateForm.academyCourses().academyCourseInput(0).locator).toHaveValue(/^1:/)

  // Verify student is still enrolled in Course 1
  expect(await academyIntegration().isStudentEnrolledInCourse('bob.propagate@example.com', 1)).toBe(
    true,
  )
  // Student should STILL be enrolled in Course 33 because product 2 still has it
  expect(
    await academyIntegration().isStudentEnrolledInCourse('bob.propagate@example.com', 33),
  ).toBe(true)
})

test('disconnected sales are not affected by product academy course updates', async ({page}) => {
  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  // Setup: Create a student
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Alice', lastName: 'Wonder'}],
      emails: ['alice.propagate@example.com'],
      phones: ['1111111111'],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  // Create a product with one academy course
  const productNumber = await createProduct(
    {
      name: 'Test Product',
      productType: 'recorded',
      academyCourses: [1],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a sales event with this product
  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/test',
      productsForSale: [productNumber],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a sale via UI but DO NOT connect it
  await page.goto(new URL('/sales/new', url()).href)
  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await Promise.all([
    newForm.studentInput().locator.fill(`${studentNumber}`),
    page.waitForLoadState('networkidle'),
  ])
  await newForm.studentInput().locator.blur()
  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.fill('100')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  // Do NOT connect the sale - leave it disconnected
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Disconnected from External Providers',
  )

  // Verify student is NOT enrolled (sale not connected)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('alice.propagate@example.com', 1),
  ).toBe(false)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('alice.propagate@example.com', 33),
  ).toBe(false)

  // Navigate to the product page and update it to add Course 33
  await page.goto(new URL(`/products/${productNumber}`, url()).href)
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  await updateForm.academyCourses().addButton().locator.click()
  await updateForm.academyCourses().academyCourseInput(1).locator.fill('33')

  // Save the product update (this triggers propagation)
  await updateForm.updateButton().locator.click()

  // Wait for the update to complete by checking the form reflects the new values
  await expect(updateForm.academyCourses().academyCourseInput(1).locator).toHaveValue(/^33:/)

  // Student should still NOT be enrolled in any course (sale was not connected)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('alice.propagate@example.com', 1),
  ).toBe(false)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('alice.propagate@example.com', 33),
  ).toBe(false)
})
