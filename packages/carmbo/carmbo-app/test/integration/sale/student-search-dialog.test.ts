import {test, expect} from '@playwright/test'
import {createNewSalePageModel} from '../../page-model/sales/new-sale-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {studentSearchDialogPageModel} from '../../page-model/sales/student-search-dialog.model.ts'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {initializeHtmxSettled} from '../common/wait-for-htmx.ts'

const {url, sql, smooveIntegration} = setup(import.meta.url)

test.use({viewport: {width: 1024, height: 1024}})

test('search for student and choose', async ({page}) => {
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'John', lastName: 'Doe'}],
      emails: ['john.doe@example.com'],
      phones: ['0501234567'],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  const product1Number = await createProduct(
    {name: 'Product One', productType: 'recorded'},
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

  await page.goto(new URL('/sales/new', url()).href)
  const newSaleModel = createNewSalePageModel(page)
  const dialog = studentSearchDialogPageModel(page)
  await page.waitForURL(newSaleModel.urlRegex)

  const newForm = newSaleModel.form()

  // Fill sales event first
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')

  const wait = await initializeHtmxSettled(page)
  // Click "Search / Create" button
  await newForm.searchCreateStudentButton().locator.click()
  await expect(dialog.locator).toBeVisible()
  await wait()

  // Search for student

  await dialog.searchInput().locator.fill('John')
  await dialog.searchInput().locator.blur()

  // Results should appear
  await expect(dialog.results().items().locator).toHaveCount(1)
  await expect(dialog.results().items().item(0).locator).toContainText('John Doe')
  await expect(dialog.results().items().item(0).locator).toContainText('john.doe@example.com')

  // Click "Choose"
  await dialog.results().items().item(0).chooseButton().locator.click()
  await page.waitForLoadState('networkidle')

  // Dialog should close and student field should be populated
  await expect(dialog.locator).not.toBeVisible()
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)

  await expect(newForm.salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
})

test('create new student from dialog', async ({page}) => {
  const product1Number = await createProduct(
    {name: 'Product One', productType: 'recorded'},
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

  await page.goto(new URL('/sales/new', url()).href)
  const newSaleModel = createNewSalePageModel(page)
  const dialog = studentSearchDialogPageModel(page)
  await page.waitForURL(newSaleModel.urlRegex)

  const newForm = newSaleModel.form()

  // Fill sales event first
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')

  // Open dialog
  const wait = await initializeHtmxSettled(page)
  await newForm.searchCreateStudentButton().locator.click()
  await expect(dialog.locator).toBeVisible()
  await wait()

  // Open create section
  await dialog.createSection().summary().locator.click()

  // Fill create form
  await dialog.createSection().emailInput().locator.fill('new-student@example.com')
  await dialog.createSection().firstNameInput().locator.fill('Jane')
  await dialog.createSection().lastNameInput().locator.fill('Smith')
  await dialog.createSection().phoneInput().locator.fill('0509876543')

  // Click "Create & Choose"
  const wait2 = await initializeHtmxSettled(page)
  await dialog.createSection().createAndChooseButton().locator.click()
  await wait2()

  // Dialog should close and student field should be populated
  await expect(dialog.locator).not.toBeVisible()
  await expect(newForm.studentInput().locator).toHaveValue(/Jane Smith/)

  // Verify we can now create the sale with this student
  await newForm.finalSaleRevenueInput().locator.fill('100')
  await newForm.createButton().locator.click()

  const updateSaleModel = createUpdateSalePageModel(page)
  await page.waitForURL(updateSaleModel.urlRegex)
  await expect(updateSaleModel.form().studentInput().locator).toHaveValue(/Jane Smith/)
})

test('cancel dialog leaves form unchanged', async ({page}) => {
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'John', lastName: 'Doe'}],
      emails: ['john.doe@example.com'],
      phones: [],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  const product1Number = await createProduct(
    {name: 'Product One', productType: 'recorded'},
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

  await page.goto(new URL('/sales/new', url()).href)
  const newSaleModel = createNewSalePageModel(page)
  const dialog = studentSearchDialogPageModel(page)
  await page.waitForURL(newSaleModel.urlRegex)

  const newForm = newSaleModel.form()

  // Fill sales event and student manually first
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)

  // Open dialog then cancel
  const wait = await initializeHtmxSettled(page)

  await newForm.searchCreateStudentButton().locator.click()
  await expect(dialog.locator).toBeVisible()
  await wait()

  await dialog.cancelButton().locator.click()
  await expect(dialog.locator).not.toBeVisible()

  // Student field should still have the original value
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)
})

test('search with no results', async ({page}) => {
  const product1Number = await createProduct(
    {name: 'Product One', productType: 'recorded'},
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

  await page.goto(new URL('/sales/new', url()).href)
  const newSaleModel = createNewSalePageModel(page)
  const dialog = studentSearchDialogPageModel(page)
  await page.waitForURL(newSaleModel.urlRegex)

  const newForm = newSaleModel.form()

  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')

  // Open dialog
  const wait = await initializeHtmxSettled(page)
  await newForm.searchCreateStudentButton().locator.click()
  await expect(dialog.locator).toBeVisible()
  await wait()

  // Search for non-existent student
  await dialog.searchInput().locator.fill('nonexistent-person')

  // Should show "no students found"
  await expect(dialog.results().locator).toContainText('No students found')
})

test('search and choose on update sale page', async ({page}) => {
  const student1Number = await createStudent(
    {
      names: [{firstName: 'John', lastName: 'Doe'}],
      emails: ['john.doe@example.com'],
      phones: [],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  const student2Number = await createStudent(
    {
      names: [{firstName: 'Jane', lastName: 'Smith'}],
      emails: ['jane.smith@example.com'],
      phones: ['0507654321'],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  const product1Number = await createProduct(
    {name: 'Product One', productType: 'recorded'},
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

  // Create a sale with student 1
  await page.goto(new URL('/sales/new', url()).href)
  const newSaleModel = createNewSalePageModel(page)
  await page.waitForURL(newSaleModel.urlRegex)

  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.studentInput().locator.fill(`${student1Number}`)
  await newForm.studentInput().locator.blur()
  await expect(newForm.studentInput().locator).toHaveValue(`${student1Number}: John Doe`)

  await newForm.finalSaleRevenueInput().locator.fill('50')
  await newForm.finalSaleRevenueInput().locator.blur()
  await newForm.createButton().locator.click()

  const updateSaleModel = createUpdateSalePageModel(page)
  await page.waitForURL(updateSaleModel.urlRegex)

  const updateForm = updateSaleModel.form()
  await expect(updateForm.studentInput().locator).toHaveValue(`${student1Number}: John Doe`)

  // Use dialog to switch to student 2
  const dialog = studentSearchDialogPageModel(page)
  const wait = await initializeHtmxSettled(page)
  await updateForm.searchCreateStudentButton().locator.click()
  await expect(dialog.locator).toBeVisible()
  await wait()

  const wait2 = await initializeHtmxSettled(page)
  await dialog.searchInput().locator.fill('Jane')
  await wait2()

  await expect(dialog.results().items().locator).toHaveCount(1)
  await dialog.results().items().item(0).chooseButton().locator.click()
  await page.waitForLoadState('networkidle')

  await expect(dialog.locator).not.toBeVisible()
  await expect(updateForm.studentInput().locator).toHaveValue(`${student2Number}: Jane Smith`)
})

test('create button requires email and name fields', async ({page}) => {
  const product1Number = await createProduct(
    {name: 'Product One', productType: 'recorded'},
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

  await page.goto(new URL('/sales/new', url()).href)
  const newSaleModel = createNewSalePageModel(page)
  const dialog = studentSearchDialogPageModel(page)
  await page.waitForURL(newSaleModel.urlRegex)

  const newForm = newSaleModel.form()

  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')

  // Open dialog
  const wait = await initializeHtmxSettled(page)
  await newForm.searchCreateStudentButton().locator.click()
  await expect(dialog.locator).toBeVisible()
  await wait()

  // Open create section
  await dialog.createSection().summary().locator.click()

  // Track whether a request to quick-create-student is made
  let quickCreateRequestFired = false
  await page.route('**/sales/quick-create-student', (route) => {
    quickCreateRequestFired = true
    route.continue()
  })

  // Click "Create & Choose" without filling any fields — should NOT fire a request
  await dialog.createSection().createAndChooseButton().locator.click()
  await page.waitForTimeout(500)
  expect(quickCreateRequestFired).toBe(false)
  await expect(dialog.locator).toBeVisible()

  // Fill only email, still missing names — should NOT fire
  quickCreateRequestFired = false
  await dialog.createSection().emailInput().locator.fill('test@example.com')
  await dialog.createSection().createAndChooseButton().locator.click()
  await page.waitForTimeout(500)
  expect(quickCreateRequestFired).toBe(false)
  await expect(dialog.locator).toBeVisible()

  // Fill first name too, still missing last name — should NOT fire
  quickCreateRequestFired = false
  await dialog.createSection().firstNameInput().locator.fill('Test')
  await dialog.createSection().createAndChooseButton().locator.click()
  await page.waitForTimeout(500)
  expect(quickCreateRequestFired).toBe(false)
  await expect(dialog.locator).toBeVisible()

  // Now fill last name too — should succeed and fire the request
  quickCreateRequestFired = false
  await dialog.createSection().lastNameInput().locator.fill('User')
  const wait2 = await initializeHtmxSettled(page)
  await dialog.createSection().createAndChooseButton().locator.click()
  await wait2()

  expect(quickCreateRequestFired).toBe(true)
  await expect(dialog.locator).not.toBeVisible()
  await expect(newForm.studentInput().locator).toHaveValue(/Test User/)
})
