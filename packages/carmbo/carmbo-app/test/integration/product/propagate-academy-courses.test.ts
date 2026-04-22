import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {createNewSalePageModel} from '../../page-model/sales/new-sale-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {createUpdateProductPageModel} from '../../page-model/products/update-product-page.model.ts'
import {waitForAllJobsToBeDone} from '../common/wait-for-all-jobs-to-be-done.ts'
import {
  cardcomWebhookUrl,
  cardcomRecurringPaymentWebhookUrl,
} from '../sale/common/cardcom-webhook.ts'
import {cancelSubscription} from '../common/cancel-subscription.ts'
import {initializeHtmxSettled} from '../common/wait-for-htmx.ts'

const {url, sql, smooveIntegration, academyIntegration, cardcomIntegration} = setup(import.meta.url)

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
      academyCourses: [{courseId: 1, accountSubdomain: 'carmel'}], // Course 1
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
  await page.waitForLoadState('networkidle')
  await expect(newForm.salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)
  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).quantity().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.products().product(0).unitPrice().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.finalSaleRevenueInput().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  // Connect the sale via UI (this enrolls student in Course 1)
  await updateSaleModel.form().connectButton().locator.click()
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Verify student is enrolled in Course 1
  expect(
    await academyIntegration().isStudentEnrolledInCourse('john.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('john.propagate@example.com', 100, {
      accountSubdomain: 'inspiredlivingdaily',
    }),
  ).toBe(false)

  // Navigate to the product page and update it to add Course 100 from inspiredlivingdaily
  await page.goto(new URL(`/products/${productNumber}`, url()).href)
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  const wait = await initializeHtmxSettled(page)
  await updateForm.academyCourses().addButton().locator.click()
  await wait()

  await updateForm.academyCourses().subdomainSelect(1).locator.selectOption('inspiredlivingdaily')
  await wait()
  await updateForm.academyCourses().academyCourseInput(1).locator.fill('100')
  await updateForm.academyCourses().academyCourseInput(1).locator.blur()

  // Save the product update (this triggers propagation)
  await updateForm.updateButton().locator.click()

  // Wait for the update to complete by checking the form reflects the new values
  await expect(updateForm.academyCourses().academyCourseInput(1).locator).toHaveValue(/^100:/)

  // Wait for all background jobs to finish before asserting
  await waitForAllJobsToBeDone(page, url())

  // Verify student is now enrolled in both courses
  expect(
    await academyIntegration().isStudentEnrolledInCourse('john.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('john.propagate@example.com', 100, {
      accountSubdomain: 'inspiredlivingdaily',
    }),
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

  // Create a club product with two academy courses (only club products trigger unenrollment)
  const productNumber = await createProduct(
    {
      name: 'Test Product',
      productType: 'club',
      academyCourses: [
        {courseId: 1, accountSubdomain: 'carmel'},
        {courseId: 100, accountSubdomain: 'inspiredlivingdaily'},
      ], // Course 1 (carmel) and Course 100 (inspiredlivingdaily)
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
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.studentInput().locator.blur()
  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  // Connect the sale via UI (this enrolls student in both courses)
  await updateSaleModel.form().connectButton().locator.click()
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Verify student is enrolled in both courses
  expect(
    await academyIntegration().isStudentEnrolledInCourse('jane.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('jane.propagate@example.com', 100, {
      accountSubdomain: 'inspiredlivingdaily',
    }),
  ).toBe(true)

  // Navigate to the product page and update it to remove Course 100 (inspiredlivingdaily)
  await page.goto(new URL(`/products/${productNumber}`, url()).href)
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  // Remove the second course (Course 100) by clicking the trash button
  await updateForm.academyCourses().trashButton(1).locator.click()

  // Save the product update (this triggers propagation)
  await updateForm.updateButton().locator.click()

  // Wait for the page refresh to complete after the update
  await page.waitForLoadState('networkidle')

  // Wait for all background jobs to finish before asserting
  await waitForAllJobsToBeDone(page, url())

  // Verify student is still enrolled in Course 1 but not Course 100
  expect(
    await academyIntegration().isStudentEnrolledInCourse('jane.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('jane.propagate@example.com', 100, {
      accountSubdomain: 'inspiredlivingdaily',
    }),
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

  // Create product 1 with Course 1 (carmel) and Course 100 (inspiredlivingdaily) (club type triggers unenrollment)
  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'club',
      academyCourses: [
        {courseId: 1, accountSubdomain: 'carmel'},
        {courseId: 100, accountSubdomain: 'inspiredlivingdaily'},
      ],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create product 2 with Course 100 (inspiredlivingdaily) (shared with product 1)
  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'challenge',
      academyCourses: [{courseId: 100, accountSubdomain: 'inspiredlivingdaily'}],
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
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await page.waitForLoadState('networkidle')

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
  expect(
    await academyIntegration().isStudentEnrolledInCourse('bob.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('bob.propagate@example.com', 100, {
      accountSubdomain: 'inspiredlivingdaily',
    }),
  ).toBe(true)

  // Navigate to product 1 page and update it to remove Course 100 (but product 2 still has it)
  await page.goto(new URL(`/products/${product1Number}`, url()).href)
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  // Remove the second course (Course 100) by clicking the trash button
  await updateForm.academyCourses().trashButton(1).locator.click()

  // Save the product update (this triggers propagation)
  await updateForm.updateButton().locator.click()

  // Wait for the update to complete by checking that only one academy course input remains
  await expect(updateForm.academyCourses().academyCourseInput(0).locator).toHaveValue(/^1:/)

  // Wait for all background jobs to finish before asserting
  await waitForAllJobsToBeDone(page, url())

  // Verify student is still enrolled in Course 1
  expect(
    await academyIntegration().isStudentEnrolledInCourse('bob.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)
  // Student should STILL be enrolled in Course 100 because product 2 still has it
  expect(
    await academyIntegration().isStudentEnrolledInCourse('bob.propagate@example.com', 100, {
      accountSubdomain: 'inspiredlivingdaily',
    }),
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
      academyCourses: [{courseId: 1, accountSubdomain: 'carmel'}],
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
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.studentInput().locator.blur()
  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  // Do NOT connect the sale - leave it disconnected
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Disconnected from External Providers',
  )

  // Verify student is NOT enrolled (sale not connected)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('alice.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(false)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('alice.propagate@example.com', 33, {
      accountSubdomain: 'carmel',
    }),
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

  // Wait for all background jobs to finish before asserting
  await waitForAllJobsToBeDone(page, url())

  // Student should still NOT be enrolled in any course (sale was not connected)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('alice.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(false)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('alice.propagate@example.com', 33, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(false)
})

test('removing course from non-club product does NOT unenroll students', async ({page}) => {
  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  // Setup: Create a student
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Eve', lastName: 'Green'}],
      emails: ['eve.propagate@example.com'],
      phones: ['2222222222'],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  // Create a recorded product with two academy courses (non-club, so removal should NOT unenroll)
  const productNumber = await createProduct(
    {
      name: 'Recorded Product',
      productType: 'recorded',
      academyCourses: [
        {courseId: 1, accountSubdomain: 'carmel'},
        {courseId: 33, accountSubdomain: 'carmel'},
      ],
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
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  // Connect the sale via UI (this enrolls student in both courses)
  await updateSaleModel.form().connectButton().locator.click()
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Verify student is enrolled in both courses
  expect(
    await academyIntegration().isStudentEnrolledInCourse('eve.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('eve.propagate@example.com', 33, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)

  // Navigate to the product page and remove Course 33
  await page.goto(new URL(`/products/${productNumber}`, url()).href)
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  await updateForm.academyCourses().trashButton(1).locator.click()

  // Save the product update
  await updateForm.updateButton().locator.click()

  // Wait for all background jobs to finish before asserting
  await waitForAllJobsToBeDone(page, url())

  // Student should STILL be enrolled in both courses because product is not a club
  expect(
    await academyIntegration().isStudentEnrolledInCourse('eve.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('eve.propagate@example.com', 33, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)
})

test('removing course from club product does NOT unenroll if another sale has that course', async ({
  page,
}) => {
  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  // Setup: Create a student
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Frank', lastName: 'Cross'}],
      emails: ['frank.propagate@example.com'],
      phones: ['3333333333'],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  // Create a club product with Course 1 and Course 33
  const clubProductNumber = await createProduct(
    {
      name: 'Club Product',
      productType: 'club',
      academyCourses: [
        {courseId: 1, accountSubdomain: 'carmel'},
        {courseId: 33, accountSubdomain: 'carmel'},
      ],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a recorded product with Course 33 (same course as club product)
  const recordedProductNumber = await createProduct(
    {
      name: 'Recorded Product',
      productType: 'recorded',
      academyCourses: [{courseId: 33, accountSubdomain: 'carmel'}],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create two separate sales events, one for each product
  const salesEvent1Number = await createSalesEvent(
    {
      name: 'Club Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/club',
      productsForSale: [clubProductNumber],
    },
    undefined,
    new Date(),
    sql(),
  )

  const salesEvent2Number = await createSalesEvent(
    {
      name: 'Recorded Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/recorded',
      productsForSale: [recordedProductNumber],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create and connect sale 1 (club product) via UI
  await page.goto(new URL('/sales/new', url()).href)
  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  let newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEvent1Number}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  await updateSaleModel.form().connectButton().locator.click()
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Create and connect sale 2 (recorded product) via UI
  await page.goto(new URL('/sales/new', url()).href)
  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEvent2Number}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.fill('50')
  await newForm.finalSaleRevenueInput().locator.fill('50')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  await updateSaleModel.form().connectButton().locator.click()
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Verify student is enrolled in both courses
  expect(
    await academyIntegration().isStudentEnrolledInCourse('frank.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('frank.propagate@example.com', 33, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)

  // Navigate to the club product and remove Course 33
  await page.goto(new URL(`/products/${clubProductNumber}`, url()).href)
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  await updateForm.academyCourses().trashButton(1).locator.click()

  // Save the product update (this triggers propagation)
  await updateForm.updateButton().locator.click()

  // Wait for all background jobs to finish
  await waitForAllJobsToBeDone(page, url())

  // Student should still be enrolled in Course 1 (still on club product)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('frank.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)
  // Student should STILL be enrolled in Course 33 because the recorded product in another sale has it
  expect(
    await academyIntegration().isStudentEnrolledInCourse('frank.propagate@example.com', 33, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)
})

test('disconnected (previously connected) sales are not affected by product academy course updates', async ({
  page,
}) => {
  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  // Setup: Create a student
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Grace', lastName: 'Hill'}],
      emails: ['grace.propagate@example.com'],
      phones: ['4444444444'],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  // Create a club product with Course 1
  const productNumber = await createProduct(
    {
      name: 'Club Product',
      productType: 'club',
      academyCourses: [{courseId: 1, accountSubdomain: 'carmel'}],
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
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  // Connect the sale (enrolls student in Course 1)
  await updateSaleModel.form().connectButton().locator.click()
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Verify student is enrolled in Course 1
  expect(
    await academyIntegration().isStudentEnrolledInCourse('grace.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)

  // Disconnect the sale (unenrolls student from Course 1)
  await updateSaleModel.form().disconnectButton().locator.click()
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Disconnected from External Providers',
  )

  // Verify student is no longer enrolled in Course 1 after disconnect
  expect(
    await academyIntegration().isStudentEnrolledInCourse('grace.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(false)

  // Navigate to the product page and add Course 33
  await page.goto(new URL(`/products/${productNumber}`, url()).href)
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  await updateForm.academyCourses().addButton().locator.click()
  await updateForm.academyCourses().academyCourseInput(1).locator.fill('33')

  // Save the product update (this triggers propagation)
  await updateForm.updateButton().locator.click()

  // Wait for all background jobs to finish
  await waitForAllJobsToBeDone(page, url())

  // Student should NOT be enrolled in any course (sale was disconnected)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('grace.propagate@example.com', 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(false)
  expect(
    await academyIntegration().isStudentEnrolledInCourse('grace.propagate@example.com', 33, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(false)
})

test('unsubscribed (cancelled subscription) sales are not affected by product academy course updates', async ({
  page,
}) => {
  const updateProductModel = createUpdateProductPageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)

  const customerEmail = 'helen.propagate@example.com'
  const customerName = 'Helen Wave'
  const customerPhone = '5555555555'

  // Create a club product with Course 1
  const productNumber = await createProduct(
    {
      name: 'Club Product',
      productType: 'club',
      academyCourses: [{courseId: 1, accountSubdomain: 'carmel'}],
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

  // Create a standing order sale via Cardcom simulation (this auto-connects and enrolls)
  await cardcomIntegration()._test_simulateCardcomStandingOrder(
    {
      productsSold: [
        {
          productId: productNumber.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Club Product',
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

  // Verify student is enrolled in Course 1
  await expect(async () => {
    expect(
      await academyIntegration().isStudentEnrolledInCourse(customerEmail, 1, {
        accountSubdomain: 'carmel',
      }),
    ).toBe(true)
  }).toPass()

  // Cancel the subscription (sets isActive = false, but sale remains connected)
  await cancelSubscription(page, url(), productNumber, customerEmail)

  // Verify the sale is now unsubscribed but still connected
  await page.goto(new URL('/sales/1', url()).href)
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Subscription (unsubscribed) | Connected to External Providers',
  )

  // Navigate to the product page and add Course 33
  await page.goto(new URL(`/products/${productNumber}`, url()).href)
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  await updateForm.academyCourses().addButton().locator.click()
  await updateForm.academyCourses().academyCourseInput(1).locator.fill('33')

  // Save the product update (this triggers propagation)
  await updateForm.updateButton().locator.click()

  // Wait for the update to complete
  await expect(updateForm.academyCourses().academyCourseInput(1).locator).toHaveValue(/^33:/)

  // Wait for all background jobs to finish
  await waitForAllJobsToBeDone(page, url())

  // Student should still be enrolled in Course 1 (from original sale connection)
  expect(
    await academyIntegration().isStudentEnrolledInCourse(customerEmail, 1, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(true)
  // Student should NOT be enrolled in Course 33 (sale is inactive due to unsubscription)
  expect(
    await academyIntegration().isStudentEnrolledInCourse(customerEmail, 33, {
      accountSubdomain: 'carmel',
    }),
  ).toBe(false)
})
