import {test, expect} from '@playwright/test'
import {createProductListPageModel} from '../../page-model/products/product-list-page.model.ts'
import {createNewProductPageModel} from '../../page-model/products/new-product-page.model.ts'
import {createUpdateProductPageModel} from '../../page-model/products/update-product-page.model.ts'
import {setup} from '../common/setup.ts'

const {url} = setup(import.meta.url)

test.use({viewport: {width: 1024, height: 1280}})

test('create product and update multiple fields', async ({page}) => {
  await page.goto(new URL('/products', url()).href)

  const productListModel = createProductListPageModel(page)
  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  await productListModel.createNewProductButton().locator.click()

  await page.waitForURL(newProductModel.urlRegex)

  // Fill the form
  const newForm = newProductModel.form()
  await newForm.nameInput().locator.fill('Test Product')
  await newForm.productTypeSelect().locator.selectOption('recorded')

  // Fill the academy courses
  await newForm.academyCourses().addButton().locator.click()
  await newForm.academyCourses().academyCourseInput(0).locator.fill('1')
  await newForm.academyCourses().addButton().locator.click()
  await newForm.academyCourses().subdomainSelect(1).locator.selectOption('inspiredlivingdaily')
  await newForm.academyCourses().academyCourseInput(1).locator.fill('100')
  await newForm.academyCourses().addButton().locator.click()
  await newForm.academyCourses().academyCourseInput(2).locator.fill('777')

  await newForm.academyCourses().trashButton(1).locator.click()

  await expect(newForm.academyCourses().academyCourseInput(0).locator).toHaveValue('1: Course 1')
  await expect(newForm.academyCourses().academyCourseInput(1).locator).toHaveValue('777: Course 3')

  // Fill the WhatsApp groups
  await newForm.whatsappGroups().addButton().locator.click()
  await newForm.whatsappGroups().whatsappGroupInput(0).locator.fill('1@g.us')
  await newForm
    .whatsappGroups()
    .whatsappGroupGoogleSheetUrlInput(0)
    .locator.fill('https://docs.google.com/spreadsheets/d/url1')
  await newForm.whatsappGroups().addButton().locator.click()
  await newForm.whatsappGroups().whatsappGroupInput(1).locator.fill('2@g.us')
  await newForm
    .whatsappGroups()
    .whatsappGroupGoogleSheetUrlInput(1)
    .locator.fill('https://docs.google.com/spreadsheets/d/url2')
  await newForm.whatsappGroups().addButton().locator.click()
  await newForm.whatsappGroups().whatsappGroupInput(2).locator.fill('3@g.us')
  await newForm
    .whatsappGroups()
    .whatsappGroupGoogleSheetUrlInput(2)
    .locator.fill('https://docs.google.com/spreadsheets/d/url3')
  await newForm.whatsappGroups().trashButton(1).locator.click()

  await expect(newForm.whatsappGroups().whatsappGroupInput(0).locator).toHaveValue(
    '1@g.us: Test Group 1',
  )
  await expect(newForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(0).locator).toHaveValue(
    'https://docs.google.com/spreadsheets/d/url1',
  )
  await expect(newForm.whatsappGroups().whatsappGroupInput(1).locator).toHaveValue(
    '3@g.us: Test Group 3',
  )
  await expect(newForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(1).locator).toHaveValue(
    'https://docs.google.com/spreadsheets/d/url3',
  )

  // Fill the Facebook groups
  await newForm.facebookGroups().addButton().locator.click()
  await newForm.facebookGroups().facebookGroupInput(0).locator.fill('group1')
  await newForm.facebookGroups().addButton().locator.click()
  await newForm.facebookGroups().facebookGroupInput(1).locator.fill('group2')
  await newForm.facebookGroups().addButton().locator.click()

  // Wait for the third Facebook group field to appear
  await expect(newForm.facebookGroups().facebookGroupInput(2).locator).toBeVisible()

  await newForm.facebookGroups().facebookGroupInput(2).locator.fill('group3')
  await newForm.facebookGroups().trashButton(1).locator.click()

  await expect(newForm.facebookGroups().facebookGroupInput(0).locator).toHaveValue('group1')
  await expect(newForm.facebookGroups().facebookGroupInput(1).locator).toHaveValue('group3')

  // Check the send skool invitation checkbox
  await expect(newForm.sendSkoolInvitationCheckbox().locator).not.toBeChecked()
  await newForm.sendSkoolInvitationCheckbox().locator.check()

  await newForm.createButton().locator.click()

  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  await expect(updateForm.nameInput().locator).toHaveValue('Test Product')
  await expect(updateForm.productTypeSelect().locator).toHaveValue('recorded')

  await expect(updateForm.academyCourses().academyCourseInput(0).locator).toHaveValue('1: Course 1')
  await expect(updateForm.academyCourses().academyCourseInput(1).locator).toHaveValue(
    '777: Course 3',
  )

  await expect(updateForm.whatsappGroups().whatsappGroupInput(0).locator).toHaveValue(
    '1@g.us: Test Group 1',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(0).locator).toHaveValue(
    'https://docs.google.com/spreadsheets/d/url1',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupInput(1).locator).toHaveValue(
    '3@g.us: Test Group 3',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(1).locator).toHaveValue(
    'https://docs.google.com/spreadsheets/d/url3',
  )

  await expect(updateForm.facebookGroups().facebookGroupInput(0).locator).toHaveValue('group1')
  await expect(updateForm.facebookGroups().facebookGroupInput(1).locator).toHaveValue('group3')

  // Verify the skool checkbox is checked after create
  await expect(updateForm.sendSkoolInvitationCheckbox().locator).toBeChecked()

  // Update the fields
  await updateForm.nameInput().locator.fill('Updated Product')
  await updateForm.productTypeSelect().locator.selectOption('challenge')

  await updateForm.academyCourses().addButton().locator.click()
  await expect(updateForm.academyCourses().academyCourseInput(2).locator).toBeVisible()
  await updateForm.academyCourses().subdomainSelect(2).locator.selectOption('inspiredlivingdaily')
  await updateForm.academyCourses().academyCourseInput(2).locator.fill('200')
  await updateForm.academyCourses().trashButton(0).locator.click()

  await updateForm.whatsappGroups().addButton().locator.click()
  await expect(updateForm.whatsappGroups().whatsappGroupInput(2).locator).toBeVisible()
  await updateForm.whatsappGroups().whatsappGroupInput(2).locator.fill('2@g.us')
  await updateForm
    .whatsappGroups()
    .whatsappGroupGoogleSheetUrlInput(2)
    .locator.fill('https://docs.google.com/spreadsheets/d/url4')
  await updateForm.whatsappGroups().trashButton(0).locator.click()

  await updateForm.facebookGroups().addButton().locator.click()
  await expect(updateForm.facebookGroups().facebookGroupInput(2).locator).toBeVisible()
  await updateForm.facebookGroups().facebookGroupInput(2).locator.fill('group4')
  await updateForm.facebookGroups().trashButton(0).locator.click()

  // Uncheck the skool checkbox
  await updateForm.sendSkoolInvitationCheckbox().locator.uncheck()

  await updateForm.updateButton().locator.click()
  await expect(updateProductModel.history().items().locator).toHaveCount(2)

  await expect(updateForm.nameInput().locator).toHaveValue('Updated Product')
  await expect(updateForm.productTypeSelect().locator).toHaveValue('challenge')

  await expect(updateForm.academyCourses().academyCourseInput(0).locator).toHaveValue(
    '777: Course 3',
  )
  await expect(updateForm.academyCourses().academyCourseInput(1).locator).toHaveValue(
    '200: ILD Course 2',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupInput(0).locator).toHaveValue(
    '3@g.us: Test Group 3',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(0).locator).toHaveValue(
    'https://docs.google.com/spreadsheets/d/url3',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupInput(1).locator).toHaveValue(
    '2@g.us: Test Group 2',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(1).locator).toHaveValue(
    'https://docs.google.com/spreadsheets/d/url4',
  )

  await expect(updateForm.facebookGroups().facebookGroupInput(0).locator).toHaveValue('group3')
  await expect(updateForm.facebookGroups().facebookGroupInput(1).locator).toHaveValue('group4')

  // Verify the skool checkbox is unchecked after update
  await expect(updateForm.sendSkoolInvitationCheckbox().locator).not.toBeChecked()

  await page.goto(new URL('/products', url()).href)

  const rows = productListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = productListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Updated Product')
  await expect(firstRow.typeCell().locator).toHaveText('challenge')
})

test('form validations', async ({page}) => {
  await page.goto(new URL('/products', url()).href)

  const productListModel = createProductListPageModel(page)
  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  await productListModel.createNewProductButton().locator.click()

  await page.waitForURL(newProductModel.urlRegex)

  const newForm = newProductModel.form()
  // Submit without name (required field)
  await newForm.createButton().locator.click()

  await expect(page.url()).toMatch(newProductModel.urlRegex)

  await newForm.nameInput().locator.fill('Valid Product')
  await newForm.productTypeSelect().locator.selectOption('club')

  // Add invalid WhatsApp group (must be in the list)
  await newForm.whatsappGroups().addButton().locator.click()
  await newForm.whatsappGroups().whatsappGroupInput(0).locator.fill('76736@g.us')

  await newForm.createButton().locator.click()
  await expect(page.url()).toMatch(newProductModel.urlRegex)

  await newForm.smooveListIdInput().locator.fill('34343443')

  await newForm.createButton().locator.click()

  await expect(page.url()).toMatch(newProductModel.urlRegex)
  await newForm.smooveListIdInput().locator.fill('')

  await newForm.smooveCancelledListIdInput().locator.fill('34343443')
  await newForm.createButton().locator.click()
  await expect(page.url()).toMatch(newProductModel.urlRegex)
  await newForm.smooveCancelledListIdInput().locator.fill('')

  await newForm.smooveRemovedListIdInput().locator.fill('34343443')
  await newForm.createButton().locator.click()
  await expect(page.url()).toMatch(newProductModel.urlRegex)
  await newForm.smooveRemovedListIdInput().locator.fill('')

  await newForm.whatsappGroups().whatsappGroupInput(0).locator.fill('1@g.us')
  await newForm
    .whatsappGroups()
    .whatsappGroupGoogleSheetUrlInput(0)
    .locator.fill('https://docs.google.com/spreadsheets/d/test1')

  await newForm.academyCourses().addButton().locator.click()
  // Fill invalid academy course (must be a number)
  await newForm.academyCourses().academyCourseInput(0).locator.fill('723674')

  await newForm.createButton().locator.click()

  await expect(page.url()).toMatch(newProductModel.urlRegex)

  // Fill valid academy course (must be a number)
  await expect(newForm.academyCourses().academyCourseInput(0).locator).toHaveValue('723674')
  await newForm.academyCourses().academyCourseInput(0).locator.fill('1')

  // Now it should succeed
  await newForm.createButton().locator.click()

  await page.waitForURL(updateProductModel.urlRegex)
})

test('remove all array fields', async ({page}) => {
  await page.goto(new URL('/products', url()).href)

  const productListModel = createProductListPageModel(page)
  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  await productListModel.createNewProductButton().locator.click()

  await page.waitForURL(newProductModel.urlRegex)

  const newForm = newProductModel.form()
  await newForm.nameInput().locator.fill('Minimal Product')
  await newForm.productTypeSelect().locator.selectOption('club')

  // Don't add any array fields - they should all be empty by default for products

  await newForm.createButton().locator.click()

  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()

  await expect(updateForm.updateButton().locator).toBeVisible()

  // Verify no array fields are visible (they start empty)
  await expect(updateForm.academyCourses().academyCourseInput(0).locator).not.toBeVisible()
  await expect(updateForm.whatsappGroups().whatsappGroupInput(0).locator).not.toBeVisible()
  await expect(updateForm.facebookGroups().facebookGroupInput(0).locator).not.toBeVisible()

  // Add new fields
  await updateForm.academyCourses().addButton().locator.click()
  await updateForm.academyCourses().academyCourseInput(0).locator.fill('1')

  await updateForm.whatsappGroups().addButton().locator.click()
  await updateForm.whatsappGroups().whatsappGroupInput(0).locator.fill('999999999@g.us')
  await updateForm
    .whatsappGroups()
    .whatsappGroupGoogleSheetUrlInput(0)
    .locator.fill('https://docs.google.com/spreadsheets/d/url5')

  await updateForm.facebookGroups().addButton().locator.click()
  await updateForm.facebookGroups().facebookGroupInput(0).locator.fill('newgroup')

  await updateForm.updateButton().locator.click()

  await expect(page.url()).toMatch(updateProductModel.urlRegex)

  await expect(updateForm.academyCourses().academyCourseInput(0).locator).toHaveValue('1: Course 1')
  await expect(updateForm.whatsappGroups().whatsappGroupInput(0).locator).toHaveValue(
    '999999999@g.us',
  )
  await expect(updateForm.whatsappGroups().whatsappGroupGoogleSheetUrlInput(0).locator).toHaveValue(
    'https://docs.google.com/spreadsheets/d/url5',
  )
  await expect(updateForm.facebookGroups().facebookGroupInput(0).locator).toHaveValue('newgroup')

  // Now remove them all
  await updateForm.academyCourses().trashButton(0).locator.click()
  await updateForm.whatsappGroups().trashButton(0).locator.click()
  await updateForm.facebookGroups().trashButton(0).locator.click()

  await updateForm.updateButton().locator.click()
  await expect(updateProductModel.history().items().locator).toHaveCount(2)

  // Verify they're gone
  await expect(updateForm.academyCourses().academyCourseInput(0).locator).not.toBeVisible()
  await expect(updateForm.whatsappGroups().whatsappGroupInput(0).locator).not.toBeVisible()
  await expect(updateForm.facebookGroups().facebookGroupInput(0).locator).not.toBeVisible()
})

test('create smoove list from product form', async ({page}) => {
  await page.goto(new URL('/products', url()).href)

  const productListModel = createProductListPageModel(page)
  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  await productListModel.createNewProductButton().locator.click()
  await page.waitForURL(newProductModel.urlRegex)

  const newForm = newProductModel.form()
  await newForm.nameInput().locator.fill('Product With Created Smoove Lists')

  // Click the Create button for smooveListId
  await newForm.smooveListIdCreateButton().locator.click()

  // The dialog should appear
  const dialog = newForm.smooveListCreateDialog()
  await expect(dialog.locator).toBeVisible()

  // Fill in the list name and create
  await dialog.listNameInput().locator.fill('My New Smoove List')
  await dialog.createButton().locator.click()

  // Dialog should close and the field should be populated
  await expect(dialog.locator).not.toBeVisible()
  await expect(newForm.smooveListIdInput().locator).toHaveValue('9: My New Smoove List')

  // Create the product and verify the values are saved
  await newForm.createButton().locator.click()
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  await expect(updateForm.smooveListIdInput().locator).toHaveValue('9: My New Smoove List')

  // Create buttons should not be visible for fields that already have values
  await expect(updateForm.smooveListIdCreateButton().locator).not.toBeVisible()

  // Create buttons should be visible for fields that are empty
  await expect(updateForm.smooveRemovedListIdCreateButton().locator).toBeVisible()

  // Clear the smooveListId field — the Create button should reappear immediately (via CSS)
  await updateForm.smooveListIdInput().locator.fill('')
  await expect(updateForm.smooveListIdCreateButton().locator).toBeVisible()
})
