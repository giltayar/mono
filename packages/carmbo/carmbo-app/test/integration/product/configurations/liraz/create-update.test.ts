import {test, expect} from '@playwright/test'
import {setup} from '../../../common/setup.ts'
import {createProductListPageModel} from '../../../../page-model/products/product-list-page.model.ts'
import {createNewProductPageModel} from '../../../../page-model/products/new-product-page.model.ts'
import {createUpdateProductPageModel} from '../../../../page-model/products/update-product-page.model.ts'

const {url} = setup(import.meta.url, {
  withAcademyIntegration: false,
  withSmooveIntegration: false,
  withSkoolIntegration: true,
})

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
  await newForm.whatsappGroups().addButton().locator.click()
  await expect(newForm.whatsappGroups().whatsappGroupInput(0).locator).toBeVisible()
  await newForm.whatsappGroups().whatsappGroupInput(0).locator.fill('1@g.us')
  await expect(newForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(0).locator).toBeVisible()
  await newForm
    .whatsappGroups()
    .whatsappGroupGoogleSheetUrlInput(0)
    .locator.fill('https://docs.google.com/spreadsheets/d/test1')
  await newForm.facebookGroups().addButton().locator.click()
  await expect(newForm.facebookGroups().facebookGroupInput(0).locator).toBeVisible()
  await newForm.facebookGroups().facebookGroupInput(0).locator.fill('test-fb-group')

  await expect(newForm.academyCourses().locator).toBeHidden()
  await expect(newForm.smooveListIdInput().locator).toBeHidden()
  await expect(newForm.smooveCancellingListIdInput().locator).toBeHidden()
  await expect(newForm.smooveCancelledListIdInput().locator).toBeHidden()
  await expect(newForm.smooveRemovedListIdInput().locator).toBeHidden()

  await newForm.notesInput().locator.fill('Initial product notes')

  // Save the product
  await newForm.createButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateProductModel.urlRegex)

  const productNumber = new URL(await page.url()).pathname.split('/').at(-1)

  await expect(updateProductModel.pageTitle().locator).toHaveText(`Update Product ${productNumber}`)

  const updateForm = updateProductModel.form()
  await expect(updateForm.nameInput().locator).toHaveValue('Test Product')
  await expect(updateForm.productTypeSelect().locator).toHaveValue('recorded')
  await expect(updateForm.whatsappGroups().whatsappGroupInput(0).locator).toHaveValue(
    '1@g.us: Test Group 1',
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
  await updateForm.whatsappGroups().whatsappGroupInput(0).locator.fill('2@g.us')
  await updateForm
    .whatsappGroups()
    .whatsappGroupGoogleSheetUrlInput(0)
    .locator.fill('https://docs.google.com/spreadsheets/d/test2')
  await updateForm.facebookGroups().facebookGroupInput(0).locator.fill('updated-fb-group')
  await updateForm.notesInput().locator.fill('Updated product notes')

  // Save the product and verify data

  await updateForm.updateButton().locator.click()
  await expect(updateForm.nameInput().locator).toHaveValue('Updated Product')
  await expect(updateForm.productTypeSelect().locator).toHaveValue('challenge')
  await expect(updateForm.whatsappGroups().whatsappGroupInput(0).locator).toHaveValue(
    '2@g.us: Test Group 2',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(0).locator).toHaveValue(
    'https://docs.google.com/spreadsheets/d/test2',
  )
  await expect(updateForm.facebookGroups().facebookGroupInput(0).locator).toHaveValue(
    'updated-fb-group',
  )
  await expect(updateForm.notesInput().locator).toHaveValue('Updated product notes')

  // Back to list
  await page.goto(new URL('/products', url()).href)

  // Check that the product appears in the list
  const rows = productListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = productListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Updated Product')
  await expect(firstRow.typeCell().locator).toHaveText('challenge')
})
