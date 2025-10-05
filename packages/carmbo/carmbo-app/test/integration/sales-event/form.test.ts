import {test, expect} from '@playwright/test'
import {createSalesEventListPageModel} from '../page-model/sales-events/sales-event-list-page.model.ts'
import {createNewSalesEventPageModel} from '../page-model/sales-events/new-sales-event-page.model.ts'
import {createUpdateSalesEventPageModel} from '../page-model/sales-events/update-sales-event-page.model.ts'
import {setup} from '../common/setup.ts'

const {url} = setup(import.meta.url)

test('create sales event and update multiple fields', async ({page}) => {
  await page.goto(new URL('/sales-events', url()).href)

  const salesEventListModel = createSalesEventListPageModel(page)
  const newSalesEventModel = createNewSalesEventPageModel(page)
  const updateSalesEventModel = createUpdateSalesEventPageModel(page)

  await salesEventListModel.createNewSalesEventButton().locator.click()

  await page.waitForURL(newSalesEventModel.urlRegex)

  // Fill the form
  const newForm = newSalesEventModel.form()
  await newForm.nameInput().locator.fill('Test Sale Event')
  await newForm.fromDateInput().locator.fill('2025-01-01')
  await newForm.toDateInput().locator.fill('2025-01-31')
  await newForm.landingPageUrlInput().locator.fill('https://example.com/sale')

  // Fill the products for sale
  await newForm.productsForSale().addButton().locator.click()
  await newForm.productsForSale().productInput(0).locator.fill('1')
  await newForm.productsForSale().addButton().locator.click()
  await newForm.productsForSale().productInput(1).locator.fill('2')
  await newForm.productsForSale().addButton().locator.click()
  await newForm.productsForSale().productInput(2).locator.fill('3')

  await newForm.productsForSale().trashButton(1).locator.click()

  await expect(newForm.productsForSale().productInput(0).locator).toHaveValue('1')
  await expect(newForm.productsForSale().productInput(1).locator).toHaveValue('3')

  await newForm.createButton().locator.click()

  await page.waitForURL(updateSalesEventModel.urlRegex)

  const updateForm = updateSalesEventModel.form()
  await expect(updateForm.nameInput().locator).toHaveValue('Test Sale Event')
  await expect(updateForm.fromDateInput().locator).toHaveValue('2025-01-01')
  await expect(updateForm.toDateInput().locator).toHaveValue('2025-01-31')
  await expect(updateForm.landingPageUrlInput().locator).toHaveValue('https://example.com/sale')

  await expect(updateForm.productsForSale().productInput(0).locator).toHaveValue('1')
  await expect(updateForm.productsForSale().productInput(1).locator).toHaveValue('3')
})

test('add and remove products for sale dynamically', async ({page}) => {
  await page.goto(new URL('/sales-events', url()).href)

  const salesEventListModel = createSalesEventListPageModel(page)
  const newSalesEventModel = createNewSalesEventPageModel(page)
  const updateSalesEventModel = createUpdateSalesEventPageModel(page)

  await salesEventListModel.createNewSalesEventButton().locator.click()

  await page.waitForURL(newSalesEventModel.urlRegex)

  const newForm = newSalesEventModel.form()
  await newForm.nameInput().locator.fill('Dynamic Sale')
  await newForm.fromDateInput().locator.fill('2025-04-01')
  await newForm.toDateInput().locator.fill('2025-04-30')

  // Add multiple products
  await newForm.productsForSale().addButton().locator.click()
  await newForm.productsForSale().productInput(0).locator.fill('10')
  await newForm.productsForSale().addButton().locator.click()
  await newForm.productsForSale().productInput(1).locator.fill('20')
  await newForm.productsForSale().addButton().locator.click()
  await newForm.productsForSale().productInput(2).locator.fill('30')
  await newForm.productsForSale().addButton().locator.click()
  await newForm.productsForSale().productInput(3).locator.fill('40')

  // Remove second product (20)
  await newForm.productsForSale().trashButton(1).locator.click()

  // Verify remaining products
  await expect(newForm.productsForSale().productInput(0).locator).toHaveValue('10')
  await expect(newForm.productsForSale().productInput(1).locator).toHaveValue('30')
  await expect(newForm.productsForSale().productInput(2).locator).toHaveValue('40')

  // Remove first product (10)
  await newForm.productsForSale().trashButton(0).locator.click()

  // Verify remaining products
  await expect(newForm.productsForSale().productInput(0).locator).toHaveValue('30')
  await expect(newForm.productsForSale().productInput(1).locator).toHaveValue('40')

  await newForm.createButton().locator.click()

  await page.waitForURL(updateSalesEventModel.urlRegex)

  const updateForm = updateSalesEventModel.form()
  await expect(updateForm.productsForSale().productInput(0).locator).toHaveValue('30')
  await expect(updateForm.productsForSale().productInput(1).locator).toHaveValue('40')

  // Add more products in update mode
  await updateForm.productsForSale().addButton().locator.click()
  await updateForm.productsForSale().productInput(2).locator.fill('50')

  await updateForm.updateButton().locator.click()

  await expect(updateForm.productsForSale().productInput(0).locator).toHaveValue('30')
  await expect(updateForm.productsForSale().productInput(1).locator).toHaveValue('40')
  await expect(updateForm.productsForSale().productInput(2).locator).toHaveValue('50')
})

test('update dates and landing page url', async ({page}) => {
  await page.goto(new URL('/sales-events', url()).href)

  const salesEventListModel = createSalesEventListPageModel(page)
  const newSalesEventModel = createNewSalesEventPageModel(page)
  const updateSalesEventModel = createUpdateSalesEventPageModel(page)

  await salesEventListModel.createNewSalesEventButton().locator.click()

  await page.waitForURL(newSalesEventModel.urlRegex)

  const newForm = newSalesEventModel.form()
  await newForm.nameInput().locator.fill('Date Test Sale')
  await newForm.fromDateInput().locator.fill('2025-05-01')
  await newForm.toDateInput().locator.fill('2025-05-15')
  await newForm.landingPageUrlInput().locator.fill('https://example.com/date-sale')

  await newForm.createButton().locator.click()

  await page.waitForURL(updateSalesEventModel.urlRegex)

  const updateForm = updateSalesEventModel.form()

  // Update dates
  await updateForm.fromDateInput().locator.fill('2025-06-01')
  await updateForm.toDateInput().locator.fill('2025-06-30')
  await updateForm.landingPageUrlInput().locator.fill('https://example.com/updated-date-sale')

  await updateForm.updateButton().locator.click()

  await expect(updateForm.fromDateInput().locator).toHaveValue('2025-06-01')
  await expect(updateForm.toDateInput().locator).toHaveValue('2025-06-30')
  await expect(updateForm.landingPageUrlInput().locator).toHaveValue(
    'https://example.com/updated-date-sale',
  )
})
