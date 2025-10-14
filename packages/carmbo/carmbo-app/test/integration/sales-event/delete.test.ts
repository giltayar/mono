import {test, expect} from '@playwright/test'
import {createSalesEventListPageModel} from '../../page-model/sales-events/sales-event-list-page.model.ts'
import {createNewSalesEventPageModel} from '../../page-model/sales-events/new-sales-event-page.model.ts'
import {createUpdateSalesEventPageModel} from '../../page-model/sales-events/update-sales-event-page.model.ts'
import {setup} from '../common/setup.ts'

const {url} = setup(import.meta.url)

test('deleting a sales event', async ({page}) => {
  await page.goto(new URL('/sales-events', url()).href)

  const salesEventListModel = createSalesEventListPageModel(page)
  const newSalesEventModel = createNewSalesEventPageModel(page)
  const updateSalesEventModel = createUpdateSalesEventPageModel(page)

  // Create first sales event
  await salesEventListModel.createNewSalesEventButton().locator.click()
  await page.waitForURL(newSalesEventModel.urlRegex)

  const newForm1 = newSalesEventModel.form()
  await newForm1.nameInput().locator.fill('Sale Alpha')
  await newForm1.fromDateInput().locator.fill('2025-01-01')
  await newForm1.toDateInput().locator.fill('2025-01-31')

  await newForm1.createButton().locator.click()
  await page.waitForURL(updateSalesEventModel.urlRegex)

  // Go back to sales event list to create second sales event
  await page.goto(new URL('/sales-events', url()).href)

  await salesEventListModel.createNewSalesEventButton().locator.click()
  await page.waitForURL(newSalesEventModel.urlRegex)

  // Create second sales event
  const newForm2 = newSalesEventModel.form()
  await newForm2.nameInput().locator.fill('Sale Beta')
  await newForm2.fromDateInput().locator.fill('2025-02-01')
  await newForm2.toDateInput().locator.fill('2025-02-28')

  await newForm2.createButton().locator.click()
  await page.waitForURL(updateSalesEventModel.urlRegex)

  // Delete the second sales event (Sale Beta)
  await updateSalesEventModel.form().deleteButton().locator.click()

  await expect(updateSalesEventModel.pageTitle().locator).toContainText('(archived)')
  await expect(updateSalesEventModel.history().items().locator).toHaveCount(2)
  await expect(updateSalesEventModel.history().items().item(0).locator).toContainText('archived')
  await expect(updateSalesEventModel.history().items().item(1).locator).toContainText('created')

  // Verify form inputs are read-only after deletion
  const form = updateSalesEventModel.form()
  await expect(form.nameInput().locator).toHaveAttribute('readonly', 'true')
  await expect(form.fromDateInput().locator).toHaveAttribute('readonly', 'true')
  await expect(form.toDateInput().locator).toHaveAttribute('readonly', 'true')

  await page.goto(new URL('/sales-events', url()).href)

  // Verify only Sale Alpha is visible (Sale Beta should be archived/hidden)
  const rows = salesEventListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = salesEventListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Sale Alpha')

  // Check the "Show archived" checkbox to show archived sales events
  await salesEventListModel.search().showArchivedCheckbox().locator.click()

  // Now both sales events should be visible
  await expect(rows.locator).toHaveCount(2)

  await expect(salesEventListModel.search().showArchivedCheckbox().locator).toBeChecked()

  // Verify both sales events are present
  expect(salesEventListModel.list().rows().row(0).nameCell().locator).toHaveText('Sale Alpha')
  expect(salesEventListModel.list().rows().row(1).nameCell().locator).toHaveText('Sale Beta')

  // Uncheck the "Show archived" checkbox
  await salesEventListModel.search().showArchivedCheckbox().locator.click()

  // Should be back to only showing Sale Alpha
  await expect(rows.locator).toHaveCount(1)
  await expect(firstRow.nameCell().locator).toHaveText('Sale Alpha')
  await expect(salesEventListModel.search().showArchivedCheckbox().locator).not.toBeChecked()
})

test('restoring a sales event', async ({page}) => {
  await page.goto(new URL('/sales-events', url()).href)

  const salesEventListModel = createSalesEventListPageModel(page)
  const newSalesEventModel = createNewSalesEventPageModel(page)
  const updateSalesEventModel = createUpdateSalesEventPageModel(page)

  // Create first sales event
  await salesEventListModel.createNewSalesEventButton().locator.click()
  await page.waitForURL(newSalesEventModel.urlRegex)

  const newForm1 = newSalesEventModel.form()
  await newForm1.nameInput().locator.fill('Sale Gamma')
  await newForm1.fromDateInput().locator.fill('2025-03-01')
  await newForm1.toDateInput().locator.fill('2025-03-31')

  await newForm1.createButton().locator.click()
  await page.waitForURL(updateSalesEventModel.urlRegex)

  // Delete the sales event
  await updateSalesEventModel.form().deleteButton().locator.click()

  await expect(updateSalesEventModel.pageTitle().locator).toContainText('(archived)')
  await expect(updateSalesEventModel.form().restoreButton().locator).toBeVisible()

  // Restore the sales event
  await updateSalesEventModel.form().restoreButton().locator.click()

  await expect(updateSalesEventModel.pageTitle().locator).not.toContainText('(archived)')
  await expect(updateSalesEventModel.form().deleteButton().locator).toBeVisible()
  await expect(updateSalesEventModel.history().items().locator).toHaveCount(3)
  await expect(updateSalesEventModel.history().items().item(0).locator).toContainText('restored')
  await expect(updateSalesEventModel.history().items().item(1).locator).toContainText('archived')
  await expect(updateSalesEventModel.history().items().item(2).locator).toContainText('created')

  // Back to list
  await page.goto(new URL('/sales-events', url()).href)

  // Should see the restored sales event
  const rows = salesEventListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = salesEventListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Sale Gamma')
})
