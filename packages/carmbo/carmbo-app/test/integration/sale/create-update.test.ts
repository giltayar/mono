import {test, expect} from '@playwright/test'
import {createSaleListPageModel} from '../../page-model/sales/sale-list-page.model.ts'
import {createNewSalePageModel} from '../../page-model/sales/new-sale-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'

const {url, sql, TEST_hooks, smooveIntegration} = setup(import.meta.url)

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
    sql(),
  )

  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
    },
    undefined,
    sql(),
  )

  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'challenge',
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

  await page.goto(new URL('/sales', url()).href)

  const saleListModel = createSaleListPageModel(page)
  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)

  // Navigate to create new sale page
  await page.goto(new URL('/sales/new', url()).href)
  await page.waitForURL(newSaleModel.urlRegex)

  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  // Fill the new sale form
  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)
  await newForm.finalSaleRevenueInput().locator.fill('250')
  await newForm.cardcomInvoiceNumberInput().locator.fill('12345')

  // Save the sale
  await newForm.createButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateSaleModel.urlRegex)

  const saleNumber = new URL(await page.url()).pathname.split('/').at(-1)

  await expect(updateSaleModel.pageTitle().locator).toHaveText(`Update Sale ${saleNumber}`)

  const updateForm = updateSaleModel.form()
  await expect(updateForm.salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await expect(updateForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)
  await expect(updateForm.finalSaleRevenueInput().locator).toHaveValue('250')
  await expect(updateForm.cardcomInvoiceNumberInput().locator).toHaveValue('12345')

  // Update the sale data
  await updateForm.finalSaleRevenueInput().locator.fill('300')
  await updateForm.cardcomInvoiceNumberInput().locator.fill('54321')

  // Save the sale and verify data
  await updateForm.updateButton().locator.click()

  await expect(updateForm.finalSaleRevenueInput().locator).toHaveValue('300')
  await expect(updateForm.cardcomInvoiceNumberInput().locator).toHaveValue('54321')

  // Back to list
  await updateSaleModel.header().menu().salesMenuItem().locator.click()

  // Check that the sale appears in the list
  const rows = saleListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = saleListModel.list().rows().row(0)
  await expect(firstRow.eventCell().locator).toHaveText('Test Sales Event')
  await expect(firstRow.studentCell().locator).toHaveText('John Doe')
  await expect(firstRow.revenueCell().locator).toHaveText('₪300.00')
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
    sql(),
  )

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

  await page.goto(new URL('/sales/new', url()).href)

  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)

  await page.waitForURL(newSaleModel.urlRegex)
  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await newForm.finalSaleRevenueInput().locator.fill('100')

  await newForm.discardButton().locator.click()

  await expect(newForm.salesEventInput().locator).toHaveValue('')
  await expect(newForm.studentInput().locator).toHaveValue('')
  await expect(newForm.finalSaleRevenueInput().locator).toHaveValue('')

  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  const updateForm = updateSaleModel.form()
  await expect(updateForm.salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await expect(updateForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)

  await updateForm.finalSaleRevenueInput().locator.fill('200')

  await updateForm.discardButton().locator.click()

  await expect(updateForm.finalSaleRevenueInput().locator).not.toHaveValue('200')
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
    sql(),
  )

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

  await page.goto(new URL('/sales/new', url()).href)

  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)

  await page.waitForURL(newSaleModel.urlRegex)

  await expect(newSaleModel.form().finalSaleRevenueInput().locator).toHaveValue('')
  await expect(newSaleModel.form().cardcomInvoiceNumberInput().locator).toHaveValue('')

  await newSaleModel.form().salesEventInput().locator.fill(`${salesEventNumber}`)
  await newSaleModel.form().salesEventInput().locator.blur()
  await newSaleModel.form().studentInput().locator.fill(`${studentNumber}`)
  await newSaleModel.form().studentInput().locator.blur()

  await newSaleModel.form().createButton().locator.click()

  await page.waitForURL(updateSaleModel.urlRegex)

  await expect(updateSaleModel.form().finalSaleRevenueInput().locator).toHaveValue('0')
  await expect(updateSaleModel.form().cardcomInvoiceNumberInput().locator).toHaveValue('')

  await updateSaleModel.form().finalSaleRevenueInput().locator.fill('150')

  await updateSaleModel.form().updateButton().locator.click()

  await expect(updateSaleModel.form().finalSaleRevenueInput().locator).toHaveValue('150')
  await expect(updateSaleModel.history().items().locator).toHaveCount(2)
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
    sql(),
  )

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

  await page.goto(new URL('/sales/new', url()).href)

  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)

  await page.waitForURL(newSaleModel.urlRegex)

  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  // Fill the new sale form
  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await newForm.finalSaleRevenueInput().locator.fill('100')

  TEST_hooks['createSale'] = () => {
    throw new Error('ouch!')
  }

  await newForm.createButton().locator.click()

  await expect(newSaleModel.header().errorBanner().locator).toHaveText('Creating sale error: ouch!')
  delete TEST_hooks['createSale']

  await newForm.createButton().locator.click()

  await page.waitForURL(updateSaleModel.urlRegex)

  await updateSaleModel.form().finalSaleRevenueInput().locator.fill('200')

  TEST_hooks['updateSale'] = () => {
    throw new Error('double ouch!')
  }

  await updateSaleModel.form().updateButton().locator.click()

  await expect(updateSaleModel.header().errorBanner().locator).toHaveText(
    'Updating sale error: double ouch!',
  )
})
