import {test, expect} from '@playwright/test'
import {createSalesEventListPageModel} from '../../page-model/sales-events/sales-event-list-page.model.ts'
import {createNewSalesEventPageModel} from '../../page-model/sales-events/new-sales-event-page.model.ts'
import {createUpdateSalesEventPageModel} from '../../page-model/sales-events/update-sales-event-page.model.ts'
import {createViewSalesEventHistoryPageModel} from '../../page-model/sales-events/view-sales-event-history-page.model.ts'
import {setup} from '../common/setup.ts'

const {url} = setup(import.meta.url)

test('can view history', async ({page}) => {
  await page.goto(new URL('/sales-events', url()).href)

  const salesEventListModel = createSalesEventListPageModel(page)
  const newSalesEventModel = createNewSalesEventPageModel(page)
  const updateSalesEventModel = createUpdateSalesEventPageModel(page)
  const viewSalesEventHistoryModel = createViewSalesEventHistoryPageModel(page)

  await salesEventListModel.createNewSalesEventButton().locator.click()

  await page.waitForURL(newSalesEventModel.urlRegex)

  const newForm = newSalesEventModel.form()
  await newForm.nameInput().locator.fill('Sale Version 1')
  await newForm.fromDateInput().locator.fill('2025-01-01')
  await newForm.toDateInput().locator.fill('2025-01-31')

  await newForm.createButton().locator.click()

  await page.waitForURL(updateSalesEventModel.urlRegex)

  const updateHistory = updateSalesEventModel.history()
  const updateForm = updateSalesEventModel.form()

  await expect(updateHistory.items().locator).toHaveCount(1)
  await expect(updateHistory.items().item(0).locator).toContainText('create')

  await updateForm.nameInput().locator.fill('Sale Version 2')

  await updateForm.updateButton().locator.click()

  await expect(updateHistory.items().locator).toHaveCount(2)
  await expect(updateHistory.items().item(0).locator).toContainText('update')
  await expect(updateHistory.items().item(1).locator).toContainText('create')
  await expect(updateHistory.items().item(0).link().locator).not.toBeVisible()

  await updateHistory.items().item(1).link().locator.click()

  await expect(page.url()).toMatch(viewSalesEventHistoryModel.urlRegex)

  const historyPage = viewSalesEventHistoryModel.history()
  const historyForm = viewSalesEventHistoryModel.form()

  await expect(historyPage.items().locator).toHaveCount(2)
  await expect(historyPage.items().item(0).locator).toContainText('update')
  await expect(historyPage.items().item(1).locator).toContainText('create')
  await expect(historyPage.items().item(1).link().locator).not.toBeVisible()

  await expect(historyForm.nameInput().locator).toHaveValue('Sale Version 1')

  await historyPage.items().item(0).link().locator.click()

  await page.waitForURL(updateSalesEventModel.urlRegex)

  await expect(updateHistory.items().locator).toHaveCount(2)
  await expect(updateSalesEventModel.pageTitle().locator).toHaveText(/Update Sales Event \d+/)
  await expect(updateHistory.items().item(0).locator).toContainText('update')
  await expect(updateHistory.items().item(1).locator).toContainText('create')
  await expect(updateHistory.items().item(0).link().locator).not.toBeVisible()

  await expect(historyForm.nameInput().locator).toHaveValue('Sale Version 2')
})

test('multiple sales events have different histories', async ({page}) => {
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

  // Get the first sales event's URL
  const firstSalesEventUrl = await page.url()

  // Update first sales event
  const updateForm1 = updateSalesEventModel.form()
  await updateForm1.nameInput().locator.fill('Sale Alpha-Updated')

  await updateForm1.updateButton().locator.click()

  await expect(updateSalesEventModel.history().items().locator).toHaveCount(2)

  // Go back to list and create second sales event
  await page.goto(new URL('/sales-events', url()).href)

  await salesEventListModel.createNewSalesEventButton().locator.click()
  await page.waitForURL(newSalesEventModel.urlRegex)

  const newForm2 = newSalesEventModel.form()
  await newForm2.nameInput().locator.fill('Sale Beta')
  await newForm2.fromDateInput().locator.fill('2025-02-01')
  await newForm2.toDateInput().locator.fill('2025-02-28')

  await newForm2.createButton().locator.click()
  await page.waitForURL(updateSalesEventModel.urlRegex)

  // Second sales event should only have one history entry (created)
  await expect(updateSalesEventModel.history().items().locator).toHaveCount(1)
  await expect(updateSalesEventModel.history().items().item(0).locator).toContainText('create')

  // Go back to first sales event
  await page.goto(firstSalesEventUrl)

  // First sales event should still have two history entries
  await expect(updateSalesEventModel.history().items().locator).toHaveCount(2)
  await expect(updateSalesEventModel.history().items().item(0).locator).toContainText('update')
  await expect(updateSalesEventModel.history().items().item(1).locator).toContainText('create')
})

test('history shows correct data for each version', async ({page}) => {
  await page.goto(new URL('/sales-events', url()).href)

  const salesEventListModel = createSalesEventListPageModel(page)
  const newSalesEventModel = createNewSalesEventPageModel(page)
  const updateSalesEventModel = createUpdateSalesEventPageModel(page)
  const viewSalesEventHistoryModel = createViewSalesEventHistoryPageModel(page)

  await salesEventListModel.createNewSalesEventButton().locator.click()
  await page.waitForURL(newSalesEventModel.urlRegex)

  const newForm = newSalesEventModel.form()
  await newForm.nameInput().locator.fill('Original Name')
  await newForm.fromDateInput().locator.fill('2025-03-01')
  await newForm.landingPageUrlInput().locator.fill('https://example.com/original')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateSalesEventModel.urlRegex)

  const updateForm = updateSalesEventModel.form()
  await updateForm.nameInput().locator.fill('Updated Name')
  await updateForm.toDateInput().locator.fill('2025-03-31')
  await updateForm.landingPageUrlInput().locator.fill('https://example.com/updated')

  await updateForm.updateButton().locator.click()

  // View the original version
  await updateSalesEventModel.history().items().item(1).link().locator.click()
  await expect(page.url()).toMatch(viewSalesEventHistoryModel.urlRegex)

  const historyForm = viewSalesEventHistoryModel.form()
  await expect(historyForm.nameInput().locator).toHaveValue('Original Name')
  await expect(historyForm.fromDateInput().locator).toHaveValue('2025-03-01')
  await expect(historyForm.toDateInput().locator).toHaveValue('')
  await expect(historyForm.landingPageUrlInput().locator).toHaveValue(
    'https://example.com/original',
  )
})
