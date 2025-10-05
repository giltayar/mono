import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createSalesEventListPageModel} from '../page-model/sales-events/sales-event-list-page.model.ts'
import {createNewSalesEventPageModel} from '../page-model/sales-events/new-sales-event-page.model.ts'
import {createUpdateSalesEventPageModel} from '../page-model/sales-events/update-sales-event-page.model.ts'

const {url} = setup(import.meta.url)

test('create sales event then update it', async ({page}) => {
  await page.goto(new URL('/sales-events', url()).href)

  const salesEventListModel = createSalesEventListPageModel(page)
  const newSalesEventModel = createNewSalesEventPageModel(page)
  const updateSalesEventModel = createUpdateSalesEventPageModel(page)

  await salesEventListModel.createNewSalesEventButton().locator.click()

  await page.waitForURL(newSalesEventModel.urlRegex)

  await expect(newSalesEventModel.pageTitle().locator).toHaveText('New Sales Event')
  // Fill the new sales event form
  const newForm = newSalesEventModel.form()
  await newForm.nameInput().locator.fill('Test Sale')
  await newForm.fromDateInput().locator.fill('2025-01-01')
  await newForm.toDateInput().locator.fill('2025-01-31')
  await newForm.landingPageUrlInput().locator.fill('https://example.com/test-sale')

  // Add products for sale
  await newForm.productsForSale().addButton().locator.click()
  await newForm.productsForSale().productInput(0).locator.fill('1')
  await expect(newForm.productsForSale().productInput(0).locator).toHaveValue('1')
  await newForm.productsForSale().addButton().locator.click()
  await newForm.productsForSale().productInput(1).locator.fill('2')
  await expect(newForm.productsForSale().productInput(1).locator).toHaveValue('2')

  // Save the sales event
  await newForm.createButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateSalesEventModel.urlRegex)

  const salesEventNumber = new URL(await page.url()).pathname.split('/').at(-1)

  await expect(updateSalesEventModel.pageTitle().locator).toHaveText(
    `Update Sales Event ${salesEventNumber}`,
  )

  const updateForm = updateSalesEventModel.form()
  await expect(updateForm.nameInput().locator).toHaveValue('Test Sale')
  await expect(updateForm.fromDateInput().locator).toHaveValue('2025-01-01')
  await expect(updateForm.toDateInput().locator).toHaveValue('2025-01-31')
  await expect(updateForm.landingPageUrlInput().locator).toHaveValue(
    'https://example.com/test-sale',
  )
  await expect(updateForm.productsForSale().productInput(0).locator).toHaveValue('1')
  await expect(updateForm.productsForSale().productInput(1).locator).toHaveValue('2')

  // Update the sales event data
  await updateForm.nameInput().locator.fill('Updated Sale')
  await updateForm.fromDateInput().locator.fill('2025-02-01')
  await updateForm.toDateInput().locator.fill('2025-02-28')
  await updateForm.landingPageUrlInput().locator.fill('https://example.com/updated-sale')
  await updateForm.productsForSale().productInput(0).locator.fill('3')
  await updateForm.productsForSale().productInput(1).locator.fill('4')

  // Save the sales event and verify data
  await updateForm.updateButton().locator.click()
  await expect(updateForm.nameInput().locator).toHaveValue('Updated Sale')
  await expect(updateForm.fromDateInput().locator).toHaveValue('2025-02-01')
  await expect(updateForm.toDateInput().locator).toHaveValue('2025-02-28')
  await expect(updateForm.landingPageUrlInput().locator).toHaveValue(
    'https://example.com/updated-sale',
  )
  await expect(updateForm.productsForSale().productInput(0).locator).toHaveValue('3')
  await expect(updateForm.productsForSale().productInput(1).locator).toHaveValue('4')

  // Back to list
  await page.goto(new URL('/sales-events', url()).href)

  // Check that the sales event appears in the list
  const rows = salesEventListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = salesEventListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Updated Sale')
})

test('discard button', async ({page}) => {
  await page.goto(new URL('/sales-events', url()).href)

  const salesEventListModel = createSalesEventListPageModel(page)
  const newSalesEventModel = createNewSalesEventPageModel(page)

  await salesEventListModel.createNewSalesEventButton().locator.click()
  await page.waitForURL(newSalesEventModel.urlRegex)
  await expect(newSalesEventModel.pageTitle().locator).toHaveText('New Sales Event')

  const newForm = newSalesEventModel.form()
  await newForm.nameInput().locator.fill('Test Sale')
  await newForm.fromDateInput().locator.fill('2025-03-01')

  // Click discard - form should reset
  await newForm.discardButton().locator.click()

  await expect(newForm.nameInput().locator).toHaveValue('')
})
