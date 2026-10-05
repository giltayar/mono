import {test, expect} from '@playwright/test'
import {createUpdateStudentPageModel} from '@giltayar/carmbo-pages-student/testkit/page-model/update-student-page.model'
import {createStudentSalesPageModel} from '@giltayar/carmbo-pages-student/testkit/page-model/student-sales-page.model'
import {setup} from '../common/setup.ts'
import {createStudent} from '../../../src/model.ts'
import crypto from 'node:crypto'
import type {Sql} from 'postgres'

const {url, sql, smooveIntegration, ravmesserIntegration} = setup(import.meta.url)

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
    ravmesserIntegration(),
    new Date(),
    sql(),
  )

  const saleNumber = await seedStudentSale(studentNumber, sql())

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

async function seedStudentSale(studentNumber: number, sql: Sql): Promise<number> {
  const product1Number = await seedProduct('Test Product 1', sql)
  const product2Number = await seedProduct('Test Product 2', sql)
  const salesEventDataId = crypto.randomUUID()
  const salesEventHistoryId = crypto.randomUUID()
  const [{salesEventNumber}] = await sql<{salesEventNumber: number}[]>`
    INSERT INTO sales_event_history
      (id, data_id, timestamp, operation)
    VALUES
      (${salesEventHistoryId}, ${salesEventDataId}, ${new Date('2025-01-01')}, 'create')
    RETURNING sales_event_number
  `
  await sql`
    INSERT INTO sales_event
      (sales_event_number, last_history_id, last_data_id)
    VALUES
      (${salesEventNumber}, ${salesEventHistoryId}, ${salesEventDataId})
  `
  await sql`
    INSERT INTO sales_event_data
      (data_id, name, from_date, to_date, landing_page_url)
    VALUES
      (
        ${salesEventDataId},
        'Spring Sale',
        ${new Date('2025-01-01')},
        ${new Date('2025-03-31')},
        'https://example.com/spring'
      )
  `

  const saleDataId = crypto.randomUUID()
  const saleProductDataId = crypto.randomUUID()
  const saleHistoryId = crypto.randomUUID()
  const [{saleNumber}] = await sql<{saleNumber: number}[]>`
    INSERT INTO sale_history
      (id, data_id, data_product_id, timestamp, operation)
    VALUES
      (${saleHistoryId}, ${saleDataId}, ${saleProductDataId}, ${new Date('2025-01-02')}, 'create')
    RETURNING sale_number
  `
  await sql`
    INSERT INTO sale
      (sale_number, last_history_id, last_data_id, last_data_product_id)
    VALUES
      (${saleNumber}, ${saleHistoryId}, ${saleDataId}, ${saleProductDataId})
  `
  await sql`
    INSERT INTO sale_data
      (data_id, sales_event_number, student_number, timestamp, sale_type)
    VALUES
      (${saleDataId}, ${salesEventNumber}, ${studentNumber}, ${new Date('2025-01-02')}, 'one-time')
  `
  await sql`
    INSERT INTO sale_data_product
      (data_product_id, item_order, product_number, quantity, unit_price)
    VALUES
      (${saleProductDataId}, 0, ${product1Number}, 1, 50),
      (${saleProductDataId}, 1, ${product2Number}, 1, 50)
  `

  return saleNumber
}

async function seedProduct(name: string, sql: Sql): Promise<number> {
  const dataId = crypto.randomUUID()
  const historyId = crypto.randomUUID()
  const [{productNumber}] = await sql<{productNumber: number}[]>`
    INSERT INTO product_history
      (id, data_id, timestamp, operation)
    VALUES
      (${historyId}, ${dataId}, ${new Date('2025-01-01')}, 'create')
    RETURNING product_number
  `
  await sql`
    INSERT INTO product
      (product_number, last_history_id, last_data_id)
    VALUES
      (${productNumber}, ${historyId}, ${dataId})
  `
  await sql`
    INSERT INTO product_data
      (data_id, name, product_type)
    VALUES
      (${dataId}, ${name}, 'recorded')
  `

  return productNumber
}

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
    ravmesserIntegration(),
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
    ravmesserIntegration(),
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
