import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProductListPageModel} from '../../page-model/products/product-list-page.model.ts'
import {createNewProductPageModel} from '../../page-model/products/new-product-page.model.ts'
import {createUpdateProductPageModel} from '../../page-model/products/update-product-page.model.ts'

const {url, TEST_hooks} = setup(import.meta.url)

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
  await newForm.academyCourses().academyCourseInput(0).locator.fill('1')
  await expect(newForm.academyCourses().academyCourseInput(0).locator).toHaveValue('1')
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

  await newForm.smooveListIdInput().locator.fill('2')
  await newForm.smooveCancellingListIdInput().locator.fill('4')
  await newForm.smooveCancelledListIdInput().locator.fill('6')
  await newForm.smooveRemovedListIdInput().locator.fill('8')

  // Save the product
  await newForm.createButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateProductModel.urlRegex)

  const productNumber = new URL(await page.url()).pathname.split('/').at(-1)

  await expect(updateProductModel.pageTitle().locator).toHaveText(`Update Product ${productNumber}`)

  const updateForm = updateProductModel.form()
  await expect(updateForm.nameInput().locator).toHaveValue('Test Product')
  await expect(updateForm.productTypeSelect().locator).toHaveValue('recorded')
  await expect(updateForm.academyCourses().academyCourseInput(0).locator).toHaveValue('1: Course 1')
  await expect(updateForm.whatsappGroups().whatsappGroupInput(0).locator).toHaveValue(
    '1@g.us: Test Group 1',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(0).locator).toHaveValue(
    'https://docs.google.com/spreadsheets/d/test1',
  )
  await expect(updateForm.facebookGroups().facebookGroupInput(0).locator).toHaveValue(
    'test-fb-group',
  )

  await expect(updateForm.smooveListIdInput().locator).toHaveValue('2: Smoove List ID 1')
  await expect(updateForm.smooveCancellingListIdInput().locator).toHaveValue(
    '4: Smoove List Cancelling 2',
  )
  await expect(updateForm.smooveCancelledListIdInput().locator).toHaveValue(
    '6: Smoove List Cancelled 3',
  )
  await expect(updateForm.smooveRemovedListIdInput().locator).toHaveValue(
    '8: Smoove List Removed 4',
  )

  // Update the product data
  await updateForm.nameInput().locator.fill('Updated Product')
  await updateForm.productTypeSelect().locator.selectOption('challenge')
  await updateForm.academyCourses().academyCourseInput(0).locator.fill('33')
  await expect(updateForm.academyCourses().academyCourseInput(0).locator).toHaveValue('33')
  await updateForm.whatsappGroups().whatsappGroupInput(0).locator.fill('2@g.us')
  await updateForm
    .whatsappGroups()
    .whatsappGroupGoogleSheetUrlInput(0)
    .locator.fill('https://docs.google.com/spreadsheets/d/test2')
  await updateForm.facebookGroups().facebookGroupInput(0).locator.fill('updated-fb-group')
  await updateForm.smooveListIdInput().locator.fill('10')
  await updateForm.smooveCancellingListIdInput().locator.fill('12')
  await updateForm.smooveCancelledListIdInput().locator.fill('14')
  await updateForm.smooveRemovedListIdInput().locator.fill('16')

  // Save the product and verify data

  await updateForm.updateButton().locator.click()
  await expect(updateForm.nameInput().locator).toHaveValue('Updated Product')
  await expect(updateForm.productTypeSelect().locator).toHaveValue('challenge')
  await expect(updateForm.academyCourses().academyCourseInput(0).locator).toHaveValue(
    '33: Course 2',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupInput(0).locator).toHaveValue(
    '2@g.us: Test Group 2',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(0).locator).toHaveValue(
    'https://docs.google.com/spreadsheets/d/test2',
  )
  await expect(updateForm.facebookGroups().facebookGroupInput(0).locator).toHaveValue(
    'updated-fb-group',
  )
  await expect(updateForm.smooveListIdInput().locator).toHaveValue('10: Smoove List ID A')
  await expect(updateForm.smooveCancellingListIdInput().locator).toHaveValue(
    '12: Smoove List Cancelling B',
  )
  await expect(updateForm.smooveCancelledListIdInput().locator).toHaveValue(
    '14: Smoove List Cancelled C',
  )
  await expect(updateForm.smooveRemovedListIdInput().locator).toHaveValue(
    '16: Smoove List Removed D',
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
  await newForm.smooveListIdInput().locator.fill('2')
  await newForm.smooveCancellingListIdInput().locator.fill('4')
  await newForm.smooveCancelledListIdInput().locator.fill('6')
  await newForm.smooveRemovedListIdInput().locator.fill('8')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  await expect(updateForm.nameInput().locator).toHaveValue('Test Product')
  await expect(updateForm.productTypeSelect().locator).toHaveValue('bundle')

  await updateForm.nameInput().locator.fill('Updated Product')
  await updateForm.productTypeSelect().locator.selectOption('challenge')
  await updateForm.academyCourses().addButton().locator.click()
  await expect(updateForm.academyCourses().academyCourseInput(0).locator).toBeVisible()

  await updateForm.smooveListIdInput().locator.fill('10')
  await updateForm.smooveCancellingListIdInput().locator.fill('12')
  await updateForm.smooveCancelledListIdInput().locator.fill('14')
  await updateForm.smooveRemovedListIdInput().locator.fill('16')

  await updateForm.discardButton().locator.click()

  await expect(updateForm.nameInput().locator).toHaveValue('Test Product')
  await expect(updateForm.productTypeSelect().locator).toHaveValue('bundle')

  await expect(updateForm.smooveListIdInput().locator).toHaveValue('2: Smoove List ID 1')
  await expect(updateForm.smooveCancellingListIdInput().locator).toHaveValue(
    '4: Smoove List Cancelling 2',
  )
  await expect(updateForm.smooveCancelledListIdInput().locator).toHaveValue(
    '6: Smoove List Cancelled 3',
  )
  await expect(updateForm.smooveRemovedListIdInput().locator).toHaveValue(
    '8: Smoove List Removed 4',
  )
})

test('optional fields can be empty', async ({page}) => {
  await page.goto(new URL('/products', url()).href)

  const productListModel = createProductListPageModel(page)
  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  await productListModel.createNewProductButton().locator.click()

  await page.waitForURL(newProductModel.urlRegex)

  await expect(newProductModel.form().smooveListIdInput().locator).toHaveValue('')

  await newProductModel.form().nameInput().locator.fill('Minimal Product')
  await newProductModel.form().productTypeSelect().locator.selectOption('recorded')

  await newProductModel.form().createButton().locator.click()

  await page.waitForURL(updateProductModel.urlRegex)

  await expect(updateProductModel.form().smooveListIdInput().locator).toHaveValue('')

  await updateProductModel.form().nameInput().locator.fill('Updated Minimal Product')
  await updateProductModel.form().productTypeSelect().locator.selectOption('club')

  await updateProductModel.form().updateButton().locator.click()
  await expect(updateProductModel.history().items().locator).toHaveCount(2)

  await expect(updateProductModel.form().smooveListIdInput().locator).toHaveValue('')

  await updateProductModel.form().smooveListIdInput().locator.fill('2')

  await updateProductModel.form().updateButton().locator.click()
  await expect(updateProductModel.history().items().locator).toHaveCount(3)

  await expect(updateProductModel.form().smooveListIdInput().locator).toHaveValue(
    '2: Smoove List ID 1',
  )
})

test('creation/update error shows alert', async ({page}) => {
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

  TEST_hooks['createProduct'] = () => {
    throw new Error('ouch!')
  }

  await newForm.createButton().locator.click()

  await expect(newProductModel.header().errorBanner().locator).toHaveText(
    'Creating product error: ouch!',
  )
  delete TEST_hooks['createProduct']

  await newForm.createButton().locator.click()

  await page.waitForURL(updateProductModel.urlRegex)

  await updateProductModel.form().nameInput().locator.fill('Updated Product')

  TEST_hooks['updateProduct'] = () => {
    throw new Error('double ouch!')
  }

  await updateProductModel.form().updateButton().locator.click()

  await expect(updateProductModel.header().errorBanner().locator).toHaveText(
    'Updating product error: double ouch!',
  )
})
