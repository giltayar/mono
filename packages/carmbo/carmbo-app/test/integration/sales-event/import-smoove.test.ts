import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createUpdateSalesEventPageModel} from '../../page-model/sales-events/update-sales-event-page.model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model/model.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createJobPageModel} from '../../page-model/jobs/job-page.model.ts'

// Define test contacts for import testing
const testContacts = {
  100: {
    id: 100,
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    telephone: '1234567890',
    lists: [2], // Smoove List ID 1
    signupDate: new Date(),
  },
  101: {
    id: 101,
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Jones',
    telephone: '0987654321',
    lists: [2],
    signupDate: new Date(),
  },
}

const {url, sql} = setup(import.meta.url, {smooveContacts: testContacts})

test.beforeEach(async () => {
  // Create a product
  await createProduct(
    {
      name: 'Test Product',
      productType: 'bundle',
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a sales event
  await createSalesEvent(
    {
      name: 'Test Sales Event',
      landingPageUrl: 'https://example.com/test',
      productsForSale: [1],
    },
    undefined,
    new Date(),
    sql(),
  )
})

test('import from Smoove list creates a job that imports contacts as sales', async ({page}) => {
  await page.goto(new URL('/sales-events/1', url()).href)

  const updateModel = createUpdateSalesEventPageModel(page)
  const jobPageModel = createJobPageModel(page)

  // Click the Import from Smoove button
  await updateModel.smooveInformation().importFromSmooveButton().locator.click()

  // Wait for dialog to open
  await expect(updateModel.importSmooveDialog().dialog().locator).toBeVisible()

  // Select a Smoove list - fill and then blur to trigger change event
  const smooveListInput = updateModel.importSmooveDialog().smooveListInput().locator
  await smooveListInput.fill('2')

  // Start the import
  await updateModel.importSmooveDialog().startImportButton().locator.click()

  // Wait for results to show the job was submitted
  const results = updateModel.importSmooveDialog().resultsContainer().locator
  await expect(results).toContainText('Import Job Submitted')
  await expect(results).toContainText('Track import job')

  // Navigate to the job page via the link
  await results.locator('a').click()
  await page.waitForURL(jobPageModel.urlRegex)

  // Reload the job page and verify subjobs completed
  await expect(async () => {
    await page.reload()
    const subjobRows = jobPageModel.subjobsList().rows()
    await expect(subjobRows.locator).toHaveCount(2)

    await expect(subjobRows.row(0).statusCell().locator).toHaveText('✔')
    await expect(subjobRows.row(1).statusCell().locator).toHaveText('✔')
  }).toPass()

  // Verify sales were created - check the database
  const sales = await sql()`SELECT * FROM sale ORDER BY sale_number`
  expect(sales.length).toBe(2)

  // Check students were created
  const students = await sql()`SELECT se.email FROM student s
    JOIN student_email se ON se.data_id = s.last_data_id
    ORDER BY s.student_number`
  expect(students.length).toBe(2)
  expect(students.map((s) => s.email)).toContain('alice@example.com')
  expect(students.map((s) => s.email)).toContain('bob@example.com')
})

test('import is idempotent - skips contacts with existing sales', async ({page}) => {
  await page.goto(new URL('/sales-events/1', url()).href)

  const updateModel = createUpdateSalesEventPageModel(page)
  const jobPageModel = createJobPageModel(page)

  // First import
  await updateModel.smooveInformation().importFromSmooveButton().locator.click()
  await expect(updateModel.importSmooveDialog().dialog().locator).toBeVisible()
  const smooveListInput = updateModel.importSmooveDialog().smooveListInput().locator
  await smooveListInput.fill('2: Smoove List ID 1')
  await smooveListInput.dispatchEvent('change')
  await updateModel.importSmooveDialog().startImportButton().locator.click()

  // Wait for job submission
  const results = updateModel.importSmooveDialog().resultsContainer().locator
  await expect(results).toContainText('Import Job Submitted', {timeout: 15000})

  // Verify first import created 2 sales
  await expect(async () => {
    const sales = await sql()`SELECT * FROM sale ORDER BY sale_number`
    expect(sales.length).toBe(2)
  }).toPass()

  // Navigate away and back to get a fresh page
  await page.goto(new URL('/sales-events/1', url()).href)

  // Second import - should skip all contacts
  await updateModel.smooveInformation().importFromSmooveButton().locator.click()
  await expect(updateModel.importSmooveDialog().dialog().locator).toBeVisible()
  const smooveListInput2 = updateModel.importSmooveDialog().smooveListInput().locator
  await smooveListInput2.fill('2: Smoove List ID 1')
  await smooveListInput2.dispatchEvent('change')
  await updateModel.importSmooveDialog().startImportButton().locator.click()

  // Wait for job submission
  const results2 = updateModel.importSmooveDialog().resultsContainer().locator
  await expect(results2).toContainText('Import Job Submitted', {timeout: 15000})

  // Navigate to the job page
  await results2.locator('a').click()
  await page.waitForURL(jobPageModel.urlRegex)

  // Verify subjobs completed (showing skipped descriptions)
  await expect(async () => {
    await page.reload()
    const subjobRows = jobPageModel.subjobsList().rows()
    await expect(subjobRows.locator).toHaveCount(2)
    await expect(subjobRows.row(0).statusCell().locator).toHaveText('✔')
    await expect(subjobRows.row(1).statusCell().locator).toHaveText('✔')
  }).toPass()

  // Verify only 2 sales exist (not 4)
  const sales = await sql()`SELECT * FROM sale ORDER BY sale_number`
  expect(sales.length).toBe(2)
})

test('cancel button closes the dialog without importing', async ({page}) => {
  await page.goto(new URL('/sales-events/1', url()).href)

  const updateModel = createUpdateSalesEventPageModel(page)

  // Click the Import from Smoove button
  await updateModel.smooveInformation().importFromSmooveButton().locator.click()

  // Wait for dialog to open
  await expect(updateModel.importSmooveDialog().dialog().locator).toBeVisible()

  // Click cancel
  await updateModel.importSmooveDialog().cancelButton().locator.click()

  // Verify dialog is closed
  await expect(updateModel.importSmooveDialog().dialog().locator).not.toBeVisible()

  // Verify no sales were created
  const sales = await sql()`SELECT * FROM sale ORDER BY sale_number`
  expect(sales.length).toBe(0)
})
