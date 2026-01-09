import {test, expect} from '@playwright/test'
import {createUpdateStudentPageModel} from '../../page-model/students/update-student-page.model.ts'
import {createStudentSalesPageModel} from '../../page-model/students/student-sales-page.model.ts'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {createSale} from '../../../src/domain/sale/model/model.ts'

const {url, sql, smooveIntegration} = setup(import.meta.url)

test('student page shows sales tab with student sales', async ({page}) => {
  // Setup: Create student, products, sales event, and sales
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Alice', lastName: 'Johnson'}],
      emails: ['alice.johnson@example.com'],
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
      name: 'Test Product 1',
      productType: 'recorded',
    },
    undefined,
    new Date(),
    sql(),
  )

  const product2Number = await createProduct(
    {
      name: 'Test Product 2',
      productType: 'recorded',
    },
    undefined,
    new Date(),
    sql(),
  )

  const salesEventNumber = await createSalesEvent(
    {
      name: 'Spring Sale',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-03-31'),
      landingPageUrl: 'https://example.com/spring',
      productsForSale: [product1Number, product2Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  const saleNumber = await createSale(
    {
      salesEventNumber: salesEventNumber,
      studentNumber: studentNumber,
      finalSaleRevenue: 100,
      products: [
        {productNumber: product1Number, quantity: 1, unitPrice: 50},
        {productNumber: product2Number, quantity: 1, unitPrice: 50},
      ],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Navigate to student page
  await page.goto(new URL(`/students/${studentNumber}`, url()).href)

  const updateStudentModel = createUpdateStudentPageModel(page)
  const studentSalesModel = createStudentSalesPageModel(page)

  // Verify tabs are present on the student update page
  await expect(updateStudentModel.tabs().detailsTab().locator).toBeVisible()
  await expect(updateStudentModel.tabs().salesTab().locator).toBeVisible()

  // Click on Sales tab
  await updateStudentModel.tabs().salesTab().locator.click()

  // Wait for navigation to sales page
  await page.waitForURL(studentSalesModel.urlRegex)

  // Verify we're on the sales tab
  await expect(studentSalesModel.pageTitle().locator).toHaveText(`Student ${studentNumber} Sales`)

  // Verify the sales table has the sale
  const salesTable = studentSalesModel.salesTable()
  // Header row + 1 data row = 2 rows
  await expect(salesTable.rows().locator).toHaveCount(2)

  // Verify sale link is present and correct
  await expect(salesTable.saleButton(saleNumber).locator).toBeVisible()

  // Verify sales event link is present
  await expect(salesTable.salesEventLink('Spring Sale').locator).toBeVisible()

  // Verify product links are present
  await expect(salesTable.productLink('Test Product 1').locator).toBeVisible()
  await expect(salesTable.productLink('Test Product 2').locator).toBeVisible()
  // Click on sale link to navigate to sale page
  await salesTable.saleButton(saleNumber).locator.click()
  await expect(page).toHaveURL(new RegExp(`/sales/${saleNumber}$`))
})

test('student sales page shows empty table when student has no sales', async ({page}) => {
  // Setup: Create student without any sales
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Bob', lastName: 'NoSales'}],
      emails: ['bob.nosales@example.com'],
      phones: [],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  // Navigate directly to student sales page
  await page.goto(new URL(`/students/${studentNumber}/sales`, url()).href)

  const studentSalesModel = createStudentSalesPageModel(page)

  // Verify we're on the sales tab
  await expect(studentSalesModel.pageTitle().locator).toHaveText(`Student ${studentNumber} Sales`)

  // Verify the sales table has only header row (no data rows)
  const salesTable = studentSalesModel.salesTable()
  await expect(salesTable.rows().locator).toHaveCount(1) // Just header row
})

test('navigating between details and sales tabs', async ({page}) => {
  // Setup: Create student
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Charlie', lastName: 'Navigator'}],
      emails: ['charlie.navigator@example.com'],
      phones: [],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  // Start on student details page
  await page.goto(new URL(`/students/${studentNumber}`, url()).href)

  const updateStudentModel = createUpdateStudentPageModel(page)
  const studentSalesModel = createStudentSalesPageModel(page)

  // Go to sales tab
  await updateStudentModel.tabs().salesTab().locator.click()
  await page.waitForURL(studentSalesModel.urlRegex)

  // Go back to details tab
  await studentSalesModel.tabs().detailsTab().locator.click()
  await page.waitForURL(updateStudentModel.urlRegex)

  // Verify we're back on the details page
  await expect(updateStudentModel.pageTitle().locator).toHaveText(`Update Student ${studentNumber}`)
})
