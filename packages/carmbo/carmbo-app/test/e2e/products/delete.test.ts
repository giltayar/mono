import {test, expect} from '@playwright/test'
import {createProductListPageModel} from '../page-model/product-list-page.model.ts'
import {createNewProductPageModel} from '../page-model/new-product-page.model.ts'
import {createUpdateProductPageModel} from '../page-model/update-product-page.model.ts'
import {setup} from './setup.ts'

const {url} = setup(import.meta.url)

test('deleting a product', async ({page}) => {
  await page.goto(url().href)

  const productListModel = createProductListPageModel(page)
  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  // Create first product
  await productListModel.createNewProductButton().locator.click()
  await page.waitForURL(newProductModel.urlRegex)

  const newForm1 = newProductModel.form()
  await newForm1.nameInput().locator.fill('Product Alpha')
  await newForm1.productTypeSelect().locator.selectOption('recorded')

  await newForm1.createButton().locator.click()
  await page.waitForURL(updateProductModel.urlRegex)

  // Go back to product list to create second product
  await page.goto(url().href)
  await productListModel.createNewProductButton().locator.click()
  await page.waitForURL(newProductModel.urlRegex)

  // Create second product
  const newForm2 = newProductModel.form()
  await newForm2.nameInput().locator.fill('Product Beta')
  await newForm2.productTypeSelect().locator.selectOption('challenge')

  await newForm2.createButton().locator.click()
  await page.waitForURL(updateProductModel.urlRegex)

  // Delete the second product (Product Beta)
  await updateProductModel.form().deleteButton().locator.click()

  await expect(updateProductModel.pageTitle().locator).toContainText('(archived)')
  await expect(updateProductModel.history().items().locator).toHaveCount(2)
  await expect(updateProductModel.history().items().item(0).locator).toContainText('archived')
  await expect(updateProductModel.history().items().item(1).locator).toContainText('created')

  await page.goto(url().href)

  // Verify only Product Alpha is visible (Product Beta should be archived/hidden)
  const rows = productListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = productListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Product Alpha')

  // Check the "Show archived" checkbox to show archived products
  await productListModel.search().showArchivedCheckbox().locator.click()

  // Now both products should be visible
  await expect(rows.locator).toHaveCount(2)

  await expect(productListModel.search().showArchivedCheckbox().locator).toBeChecked()

  // Verify both products are present
  expect(productListModel.list().rows().row(0).nameCell().locator).toHaveText('Product Alpha')
  expect(productListModel.list().rows().row(1).nameCell().locator).toHaveText('Product Beta')

  // Uncheck the "Show archived" checkbox
  await productListModel.search().showArchivedCheckbox().locator.click()

  // Should be back to only showing Product Alpha
  await expect(rows.locator).toHaveCount(1)
  await expect(firstRow.nameCell().locator).toHaveText('Product Alpha')
  await expect(productListModel.search().showArchivedCheckbox().locator).not.toBeChecked()
})

test('restoring a product', async ({page}) => {
  await page.goto(url().href)

  const productListModel = createProductListPageModel(page)
  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  // Create first product
  await productListModel.createNewProductButton().locator.click()
  await page.waitForURL(newProductModel.urlRegex)

  const newForm1 = newProductModel.form()
  await newForm1.nameInput().locator.fill('Product Gamma')
  await newForm1.productTypeSelect().locator.selectOption('club')

  await newForm1.createButton().locator.click()
  await page.waitForURL(updateProductModel.urlRegex)

  // Delete the product
  await updateProductModel.form().deleteButton().locator.click()

  await expect(updateProductModel.pageTitle().locator).toContainText('(archived)')

  await expect(updateProductModel.form().deleteButton().locator).not.toBeVisible()

  await updateProductModel.form().restoreButton().locator.click()

  await expect(updateProductModel.history().items().locator).toHaveCount(3)
  await expect(updateProductModel.history().items().item(0).locator).toContainText('restored')
  await expect(updateProductModel.history().items().item(1).locator).toContainText('archived')
  await expect(updateProductModel.history().items().item(2).locator).toContainText('created')

  await expect(updateProductModel.pageTitle().locator).not.toContainText('(archived)')

  await page.goto(url().href)

  // Verify Product Gamma is visible again
  const rows = productListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = productListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Product Gamma')
})
