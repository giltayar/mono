import {test, expect} from '@playwright/test'
import {createProductListPageModel} from '../page-model/product-list-page.model.ts'
import {createNewProductPageModel} from '../page-model/new-product-page.model.ts'
import {createUpdateProductPageModel} from '../page-model/update-product-page.model.ts'
import {createViewProductHistoryPageModel} from '../page-model/view-product-history-page.model.ts'
import {setup} from './setup.ts'

const {url} = setup(import.meta.url)

test('can view history', async ({page}) => {
  await page.goto(url().href)

  const productListModel = createProductListPageModel(page)
  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)
  const viewProductHistoryModel = createViewProductHistoryPageModel(page)

  await productListModel.createNewProductButton().locator.click()

  await page.waitForURL(newProductModel.urlRegex)

  const newForm = newProductModel.form()
  await newForm.nameInput().locator.fill('Product Version 1')
  await newForm.productTypeSelect().locator.selectOption('recorded')

  await newForm.createButton().locator.click()

  await page.waitForURL(updateProductModel.urlRegex)

  const updateHistory = updateProductModel.history()
  const updateForm = updateProductModel.form()

  await expect(updateHistory.items().locator).toHaveCount(1)
  await expect(updateHistory.items().item(0).locator).toContainText('create')

  await updateForm.nameInput().locator.fill('Product Version 2')

  await updateForm.updateButton().locator.click()

  await expect(updateHistory.items().locator).toHaveCount(2)
  await expect(updateHistory.items().item(0).locator).toContainText('update')
  await expect(updateHistory.items().item(1).locator).toContainText('create')
  await expect(updateHistory.items().item(0).link().locator).not.toBeVisible()

  await updateHistory.items().item(1).link().locator.click()

  await expect(page.url()).toMatch(viewProductHistoryModel.urlRegex)

  const historyPage = viewProductHistoryModel.history()
  const historyForm = viewProductHistoryModel.form()

  await expect(historyPage.items().locator).toHaveCount(2)
  await expect(historyPage.items().item(0).locator).toContainText('update')
  await expect(historyPage.items().item(1).locator).toContainText('create')
  await expect(historyPage.items().item(1).link().locator).not.toBeVisible()

  await expect(historyForm.nameInput().locator).toHaveValue('Product Version 1')

  await historyPage.items().item(0).link().locator.click()

  await page.waitForURL(updateProductModel.urlRegex)

  await expect(updateHistory.items().locator).toHaveCount(2)
  await expect(updateProductModel.pageTitle().locator).toHaveText(/Update Product \d+/)
  await expect(updateHistory.items().item(0).locator).toContainText('update')
  await expect(updateHistory.items().item(1).locator).toContainText('create')
  await expect(updateHistory.items().item(0).link().locator).not.toBeVisible()

  await expect(historyForm.nameInput().locator).toHaveValue('Product Version 2')
})

test('multiple products have different histories', async ({page}) => {
  await page.goto(url().href)

  const productListModel = createProductListPageModel(page)
  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)
  const viewProductHistoryModel = createViewProductHistoryPageModel(page)

  // Create first product
  await productListModel.createNewProductButton().locator.click()
  await page.waitForURL(newProductModel.urlRegex)

  const newForm1 = newProductModel.form()
  await newForm1.nameInput().locator.fill('Product Alpha')
  await newForm1.productTypeSelect().locator.selectOption('recorded')

  await newForm1.createButton().locator.click()
  await page.waitForURL(updateProductModel.urlRegex)

  // Get the first product's URL
  const firstProductUrl = await page.url()

  // Update first product
  const updateForm1 = updateProductModel.form()
  await updateForm1.nameInput().locator.fill('Product Alpha-Updated')

  await updateForm1.updateButton().locator.click()

  await expect(updateProductModel.history().items().locator).toHaveCount(2)

  // Go back to product list to create second product
  await page.goto(url().href)
  await productListModel.createNewProductButton().locator.click()
  await page.waitForURL(newProductModel.urlRegex)

  // Create second product
  const newForm2 = newProductModel.form()
  await newForm2.nameInput().locator.fill('Product Beta')
  await newForm2.productTypeSelect().locator.selectOption('challenge')

  await newForm2.createButton().locator.click()

  await expect(updateProductModel.history().items().locator).toHaveCount(1)

  // Get the second product's number from URL
  const secondProductUrl = await page.url()

  // Update second product
  const updateForm2 = updateProductModel.form()
  await updateForm2.nameInput().locator.fill('Product Beta-Updated')

  await updateForm2.updateButton().locator.click()

  await expect(updateProductModel.history().items().locator).toHaveCount(2)

  // Verify first product's history
  await page.goto(firstProductUrl)
  await page.waitForURL(updateProductModel.urlRegex)

  const firstUpdateHistory = updateProductModel.history()
  await expect(firstUpdateHistory.items().locator).toHaveCount(2)
  await expect(firstUpdateHistory.items().item(0).locator).toContainText('update')
  await expect(firstUpdateHistory.items().item(1).locator).toContainText('create')

  // Go to first product's history page
  await firstUpdateHistory.items().item(1).link().locator.click()
  await expect(page.url()).toMatch(viewProductHistoryModel.urlRegex)

  const firstHistoryForm = viewProductHistoryModel.form()
  await expect(firstHistoryForm.nameInput().locator).toHaveValue('Product Alpha')
  await expect(firstHistoryForm.productTypeSelect().locator).toHaveValue('recorded')

  // Check the updated version of first product
  const firstHistoryPage = viewProductHistoryModel.history()
  await firstHistoryPage.items().item(0).link().locator.click()
  await expect(firstHistoryForm.nameInput().locator).toHaveValue('Product Alpha-Updated')
  await expect(firstHistoryForm.productTypeSelect().locator).toHaveValue('recorded')

  // Verify second product's history
  await page.goto(secondProductUrl)
  await page.waitForURL(updateProductModel.urlRegex)

  const secondUpdateHistory = updateProductModel.history()
  await expect(secondUpdateHistory.items().locator).toHaveCount(2)
  await expect(secondUpdateHistory.items().item(0).locator).toContainText('update')
  await expect(secondUpdateHistory.items().item(1).locator).toContainText('create')

  // Go to second product's history page
  await secondUpdateHistory.items().item(1).link().locator.click()
  await expect(page.url()).toMatch(viewProductHistoryModel.urlRegex)

  const secondHistoryForm = viewProductHistoryModel.form()
  await expect(secondHistoryForm.nameInput().locator).toHaveValue('Product Beta')
  await expect(secondHistoryForm.productTypeSelect().locator).toHaveValue('challenge')

  // Check the updated version of second product
  const secondHistoryPage = viewProductHistoryModel.history()
  await secondHistoryPage.items().item(0).link().locator.click()
  await expect(secondHistoryForm.nameInput().locator).toHaveValue('Product Beta-Updated')
  await expect(secondHistoryForm.productTypeSelect().locator).toHaveValue('challenge')
})
