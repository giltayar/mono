import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProductListPageModel} from '../page-model/products/product-list-page.model.ts'
import {createNewProductPageModel} from '../page-model/products/new-product-page.model.ts'
import {createUpdateProductPageModel} from '../page-model/products/update-product-page.model.ts'

const {url} = setup(import.meta.url)

test('create product then update it', async ({page}) => {
  await page.goto(new URL('/products', url()).href)

  const productListModel = createProductListPageModel(page)
  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  await productListModel.createNewProductButton().locator.click()

  await page.waitForURL(newProductModel.urlRegex)

  await expect(newProductModel.pageTitle().locator).toHaveText('New Product')
  // Fill the new product form
  const newForm = newProductModel.form()
  await newForm.nameInput().locator.fill('Test Product')
  await newForm.productTypeSelect().locator.selectOption('recorded')

  // Add and fill array fields
  await newForm.academyCourses().addButton().locator.click()
  await newForm.academyCourses().academyCourseInput(0).locator.fill('12345')
  await newForm.whatsappGroups().addButton().locator.click()
  await expect(newForm.whatsappGroups().whatsappGroupInput(0).locator).toBeVisible()
  await newForm.whatsappGroups().whatsappGroupInput(0).locator.fill('123456789@g.us')
  await expect(newForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(0).locator).toBeVisible()
  await newForm
    .whatsappGroups()
    .whatsappGroupGoogleSheetUrlInput(0)
    .locator.fill('https://docs.google.com/spreadsheets/d/test1')
  await newForm.facebookGroups().addButton().locator.click()
  await expect(newForm.facebookGroups().facebookGroupInput(0).locator).toBeVisible()
  await newForm.facebookGroups().facebookGroupInput(0).locator.fill('test-fb-group')

  // Save the product
  await newForm.createButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateProductModel.urlRegex)

  const productNumber = new URL(await page.url()).pathname.split('/').at(-1)

  await expect(updateProductModel.pageTitle().locator).toHaveText(`Update Product ${productNumber}`)

  const updateForm = updateProductModel.form()
  await expect(updateForm.nameInput().locator).toHaveValue('Test Product')
  await expect(updateForm.productTypeSelect().locator).toHaveValue('recorded')
  await expect(updateForm.academyCourses().academyCourseInput(0).locator).toHaveValue('12345')
  await expect(updateForm.whatsappGroups().whatsappGroupInput(0).locator).toHaveValue(
    '123456789@g.us',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(0).locator).toHaveValue(
    'https://docs.google.com/spreadsheets/d/test1',
  )
  await expect(updateForm.facebookGroups().facebookGroupInput(0).locator).toHaveValue(
    'test-fb-group',
  )

  // Update the product data
  await updateForm.nameInput().locator.fill('Updated Product')
  await updateForm.productTypeSelect().locator.selectOption('challenge')
  await updateForm.academyCourses().academyCourseInput(0).locator.fill('54321')
  await updateForm.whatsappGroups().whatsappGroupInput(0).locator.fill('987654321@g.us')
  await updateForm
    .whatsappGroups()
    .whatsappGroupGoogleSheetUrlInput(0)
    .locator.fill('https://docs.google.com/spreadsheets/d/test2')
  await updateForm.facebookGroups().facebookGroupInput(0).locator.fill('updated-fb-group')

  // Save the product and verify data

  await updateForm.updateButton().locator.click()
  await expect(updateForm.nameInput().locator).toHaveValue('Updated Product')
  await expect(updateForm.productTypeSelect().locator).toHaveValue('challenge')
  await expect(updateForm.academyCourses().academyCourseInput(0).locator).toHaveValue('54321')
  await expect(updateForm.whatsappGroups().whatsappGroupInput(0).locator).toHaveValue(
    '987654321@g.us',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(0).locator).toHaveValue(
    'https://docs.google.com/spreadsheets/d/test2',
  )
  await expect(updateForm.facebookGroups().facebookGroupInput(0).locator).toHaveValue(
    'updated-fb-group',
  )

  // Back to list
  await page.goto(new URL('/products', url()).href)

  // Check that the product appears in the list
  const rows = productListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = productListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Updated Product')
  await expect(firstRow.typeCell().locator).toHaveText('challenge')
})

test('discard button', async ({page}) => {
  await page.goto(new URL('/products', url()).href)

  const productListModel = createProductListPageModel(page)
  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  await productListModel.createNewProductButton().locator.click()
  await page.waitForURL(newProductModel.urlRegex)
  await expect(newProductModel.pageTitle().locator).toHaveText('New Product')

  const newForm = newProductModel.form()
  await newForm.nameInput().locator.fill('Test Product')
  await newForm.productTypeSelect().locator.selectOption('club')

  await newForm.discardButton().locator.click()

  await expect(newForm.nameInput().locator).toHaveValue('')
  await expect(newForm.productTypeSelect().locator).toHaveValue('recorded')

  await newForm.nameInput().locator.fill('Test Product')
  await newForm.productTypeSelect().locator.selectOption('bundle')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  await expect(updateForm.nameInput().locator).toHaveValue('Test Product')
  await expect(updateForm.productTypeSelect().locator).toHaveValue('bundle')

  await updateForm.nameInput().locator.fill('Updated Product')
  await updateForm.productTypeSelect().locator.selectOption('challenge')
  await updateForm.academyCourses().addButton().locator.click()
  await expect(updateForm.academyCourses().academyCourseInput(0).locator).toBeVisible()

  await updateForm.discardButton().locator.click()

  await expect(updateForm.nameInput().locator).toHaveValue('Test Product')
  await expect(updateForm.productTypeSelect().locator).toHaveValue('bundle')
})

test('optional fields can be empty', async ({page}) => {
  await page.goto(new URL('/products', url()).href)

  const productListModel = createProductListPageModel(page)
  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  await productListModel.createNewProductButton().locator.click()

  await page.waitForURL(newProductModel.urlRegex)

  await expect(newProductModel.form().smooveListIdInput().locator).toHaveValue('')
  await expect(newProductModel.form().cardcomProductIdInput().locator).toHaveValue('')

  await newProductModel.form().nameInput().locator.fill('Minimal Product')
  await newProductModel.form().productTypeSelect().locator.selectOption('recorded')

  await newProductModel.form().createButton().locator.click()

  await page.waitForURL(updateProductModel.urlRegex)

  await expect(updateProductModel.form().smooveListIdInput().locator).toHaveValue('')
  await expect(updateProductModel.form().cardcomProductIdInput().locator).toHaveValue('')

  await updateProductModel.form().nameInput().locator.fill('Updated Minimal Product')
  await updateProductModel.form().productTypeSelect().locator.selectOption('club')

  await updateProductModel.form().updateButton().locator.click()

  await expect(updateProductModel.form().smooveListIdInput().locator).toHaveValue('')
  await expect(updateProductModel.form().cardcomProductIdInput().locator).toHaveValue('')

  await updateProductModel.form().smooveListIdInput().locator.fill('12345')
  await updateProductModel.form().cardcomProductIdInput().locator.fill('prod-123')

  await updateProductModel.form().updateButton().locator.click()

  await expect(updateProductModel.form().smooveListIdInput().locator).toHaveValue('12345')
  await expect(updateProductModel.form().cardcomProductIdInput().locator).toHaveValue('prod-123')
})
