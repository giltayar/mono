import {test, expect} from '@playwright/test'
import {createSaleListPageModel} from '../../page-model/sales/sale-list-page.model.ts'
import {createNewSalePageModel} from '../../page-model/sales/new-sale-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {createUpdateStudentPageModel} from '../../page-model/students/update-student-page.model.ts'
import {createUpdateSalesEventPageModel} from '../../page-model/sales-events/update-sales-event-page.model.ts'
import {createUpdateProductPageModel} from '../../page-model/products/update-product-page.model.ts'

const {url, sql, TEST_hooks, smooveIntegration} = setup(import.meta.url)

test.use({viewport: {width: 1024, height: 1024}})

test('create sale then update it', async ({page}) => {
  // Setup: Create a student, sales event, and products
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
    {
      name: 'Product One',
      productType: 'recorded',
    },
    undefined,
    new Date(),
    sql(),
  )

  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'challenge',
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

  await page.goto(new URL('/sales', url()).href)

  const saleListModel = createSaleListPageModel(page)
  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const studentModel = createUpdateStudentPageModel(page)
  const salesEventModel = createUpdateSalesEventPageModel(page)
  const product1Model = createUpdateProductPageModel(page)

  // Navigate to create new sale page
  await page.goto(new URL('/sales/new', url()).href)
  await page.waitForURL(newSaleModel.urlRegex)

  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  // Fill the new sale form
  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)
  await expect(newForm.finalSaleRevenueInput().locator).toHaveAttribute('required')
  await newForm.finalSaleRevenueInput().locator.fill('7')

  await newForm.products().product(0).quantity().locator.fill('2')
  await newForm.products().product(0).unitPrice().locator.fill('1')
  await newForm.products().product(1).quantity().locator.fill('1')
  await newForm.products().product(1).unitPrice().locator.fill('3')

  // Save the sale
  await newForm.createButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateSaleModel.urlRegex)

  const saleNumber = new URL(await page.url()).pathname.split('/').at(-1)

  await expect(updateSaleModel.pageTitle().locator).toHaveText(`Update Sale ${saleNumber}`)
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Disconnected from External Providers',
  )

  const updateForm = updateSaleModel.form()
  await expect(updateForm.salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await expect(updateForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)
  await expect(updateForm.finalSaleRevenueInput().locator).toHaveValue('7')
  await expect(updateForm.cardcomInvoiceNumberInput().locator).toHaveValue('')

  await updateForm.salesEventInput().link().locator.click()

  await expect(salesEventModel.pageTitle().locator).toHaveText(
    `Update Sales Event ${salesEventNumber}`,
  )

  await page.goBack()
  await updateForm.studentInput().link().locator.click()

  await expect(studentModel.pageTitle().locator).toHaveText(`Update Student ${studentNumber}`)

  await page.goBack()

  await updateForm.products().product(0).link().locator.click()

  await expect(product1Model.pageTitle().locator).toHaveText(`Update Product ${product1Number}`)

  await page.goBack()

  // Update the sale data
  await updateForm.cardcomInvoiceNumberInput().locator.fill('54321')

  await updateForm.products().product(0).quantity().locator.fill('3')
  await updateForm.products().product(0).unitPrice().locator.fill('100')

  // Save the sale and verify data
  await updateForm.updateButton().locator.click()
  await page.waitForLoadState('networkidle')

  await expect(updateForm.finalSaleRevenueInput().locator).toHaveValue('7')
  await expect(updateForm.cardcomInvoiceNumberInput().locator).toHaveValue('54321')

  // Back to list
  await updateSaleModel.header().menu().salesMenuItem().locator.click()

  // Check that the sale appears in the list
  const rows = saleListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = saleListModel.list().rows().row(0)
  await expect(firstRow.eventCell().locator).toHaveText('Test Sales Event')
  await expect(firstRow.studentCell().locator).toHaveText('John Doe')
  await expect(firstRow.revenueCell().locator).toHaveText('₪7.00')
})

test('discard button', async ({page}) => {
  // Setup: Create a student, sales event, and products
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

  await page.goto(new URL('/sales/new', url()).href)

  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)

  await page.waitForURL(newSaleModel.urlRegex)
  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)

  await newForm.discardButton().locator.click()

  await expect(newForm.salesEventInput().locator).toHaveValue('')
  await expect(newForm.studentInput().locator).toHaveValue('')
  await expect(newForm.finalSaleRevenueInput().locator).toHaveValue('')

  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)

  await newForm.finalSaleRevenueInput().locator.fill('15')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  const updateForm = updateSaleModel.form()
  await expect(updateForm.salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await expect(updateForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)
})

test('optional fields', async ({page}) => {
  // Setup: Create a student, sales event, and products
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

  await page.goto(new URL('/sales/new', url()).href)

  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)

  await page.waitForURL(newSaleModel.urlRegex)

  await expect(newSaleModel.form().finalSaleRevenueInput().locator).toHaveValue('')
  await expect(newSaleModel.form().cardcomInvoiceNumberInput().locator).toHaveValue('')

  await newSaleModel.form().salesEventInput().locator.fill(`${salesEventNumber}`)
  await newSaleModel.form().salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await newSaleModel.form().studentInput().locator.fill(`${studentNumber}`)
  await newSaleModel.form().studentInput().locator.blur()
  await expect(newSaleModel.form().studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)

  await newSaleModel.form().finalSaleRevenueInput().locator.fill('17')
  await newSaleModel.form().finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newSaleModel.form().createButton().locator.click()

  await page.waitForURL(updateSaleModel.urlRegex)

  await expect(updateSaleModel.form().finalSaleRevenueInput().locator).toHaveValue('17')
  await expect(updateSaleModel.form().cardcomInvoiceNumberInput().locator).toHaveValue('')
})

test('transaction description field', async ({page}) => {
  // Setup: Create a student, sales event, and products
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Jane', lastName: 'Smith'}],
      emails: ['jane.smith@example.com'],
      phones: [],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

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

  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)

  // Test 1: Create sale with description using free text
  await page.goto(new URL('/sales/new', url()).href)
  await page.waitForURL(newSaleModel.urlRegex)

  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: Jane Smith`)

  await newForm.finalSaleRevenueInput().locator.fill('100')
  await newForm.transactionDescriptionInput().locator.fill('שולם בביט')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  // Verify description is saved
  await expect(updateSaleModel.form().transactionDescriptionInput().locator).toHaveValue(
    'שולם בביט',
  )

  // Test 3: Clear description (should result in null, field hidden in view mode)
  await updateSaleModel.form().transactionDescriptionInput().locator.clear()
  await updateSaleModel.form().updateButton().locator.click()
  await page.waitForLoadState('networkidle')

  await expect(updateSaleModel.form().transactionDescriptionInput().locator).toHaveValue('')
})

test('creation/update error shows alert', async ({page}) => {
  // Setup: Create a student, sales event, and products
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

  await page.goto(new URL('/sales/new', url()).href)

  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)

  await page.waitForURL(newSaleModel.urlRegex)

  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  // Fill the new sale form
  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)

  await newForm.products().product(0).quantity().locator.fill('2')
  await newForm.products().product(0).quantity().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.products().product(0).unitPrice().locator.fill('50')
  await newForm.products().product(0).unitPrice().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.finalSaleRevenueInput().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  TEST_hooks['createSale'] = () => {
    throw new Error('ouch!')
  }

  await newForm.createButton().locator.click()

  await expect(newSaleModel.header().errorBanner().locator).toHaveText('Creating sale error: ouch!')
  delete TEST_hooks['createSale']

  await newForm.createButton().locator.click()

  await page.waitForURL(updateSaleModel.urlRegex)

  await newForm.products().product(0).quantity().locator.fill('3')

  TEST_hooks['updateSale'] = () => {
    throw new Error('double ouch!')
  }

  await updateSaleModel.form().updateButton().locator.click()

  await expect(updateSaleModel.header().errorBanner().locator).toHaveText(
    'Updating sale error: double ouch!',
  )
})
