import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProductListPageModel} from '../../page-model/products/product-list-page.model.ts'
import {createNewProductPageModel} from '../../page-model/products/new-product-page.model.ts'
import {createUpdateProductPageModel} from '../../page-model/products/update-product-page.model.ts'
import {waitForHtmx} from '../common/wait-for-htmx.ts'

const {url} = setup(import.meta.url, {withRavmesserIntegration: true})

test.use({viewport: {width: 1280, height: 1280}})

test('new product defaults to ravmesser and saves its lists', async ({page}) => {
  await page.goto(new URL('/products', url()).href)

  const productListModel = createProductListPageModel(page)
  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  await productListModel.createNewProductButton().locator.click()
  await page.waitForURL(newProductModel.urlRegex)

  const newForm = newProductModel.form()

  await expect(newForm.mailingListProviderSelect().locator).toHaveValue('ravmesser')
  await expect(newForm.ravmesserListIdInput().locator).toBeVisible()
  await expect(newForm.smooveListIdInput().locator).toBeHidden()

  await newForm.nameInput().locator.fill('Ravmesser Product')
  await waitForHtmx(page, async () => {
    await newForm.ravmesserListIdInput().locator.fill('102')
    await newForm.ravmesserListIdInput().locator.blur()
  })
  await expect(newForm.ravmesserCancelledListIdInput().locator).toBeHidden()
  await waitForHtmx(page, async () => {
    await newForm.ravmesserRemovedListIdInput().locator.fill('106')
    await newForm.ravmesserRemovedListIdInput().locator.blur()
  })

  await newForm.createButton().locator.click()
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  await expect(updateForm.mailingListProviderSelect().locator).toHaveValue('ravmesser')
  await expect(updateForm.ravmesserListIdInput().locator).toHaveValue('102: Ravmesser List ID 1')
  await expect(updateForm.ravmesserRemovedListIdInput().locator).toHaveValue(
    '106: Ravmesser List Removed 3',
  )
  await expect(updateForm.smooveListIdInput().locator).toBeHidden()
})

test('a club product shows the cancelled list and removed date custom field', async ({page}) => {
  await page.goto(new URL('/products/new', url()).href)

  const newProductModel = createNewProductPageModel(page)
  const newForm = newProductModel.form()

  await expect(newForm.ravmesserCancelledListIdInput().locator).toBeHidden()
  await expect(newForm.ravmesserRemovedDateCustomFieldInput().locator).toBeHidden()

  await waitForHtmx(page, async () => {
    await newForm.productTypeSelect().locator.selectOption('club')
  })

  await expect(newForm.ravmesserCancelledListIdInput().locator).toBeVisible()
  await expect(newForm.ravmesserRemovedDateCustomFieldInput().locator).toBeVisible()
})

test('switching the provider swaps the list inputs', async ({page}) => {
  await page.goto(new URL('/products/new', url()).href)

  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)
  const newForm = newProductModel.form()

  await newForm.nameInput().locator.fill('Smoove Product')

  await waitForHtmx(page, async () => {
    await newForm.mailingListProviderSelect().locator.selectOption('smoove')
  })

  await expect(newForm.smooveListIdInput().locator).toBeVisible()
  await expect(newForm.ravmesserListIdInput().locator).toBeHidden()

  await waitForHtmx(page, async () => {
    await newForm.smooveListIdInput().locator.fill('2')
    await newForm.smooveListIdInput().locator.blur()
  })
  await waitForHtmx(page, async () => {
    await newForm.smooveRemovedListIdInput().locator.fill('8')
    await newForm.smooveRemovedListIdInput().locator.blur()
  })

  await newForm.createButton().locator.click()
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  await expect(updateForm.mailingListProviderSelect().locator).toHaveValue('smoove')
  await expect(updateForm.smooveListIdInput().locator).toHaveValue('2: Smoove List ID 1')
  await expect(updateForm.ravmesserListIdInput().locator).toBeHidden()

  // Switching back to ravmesser on update leaves the smoove values in the database untouched
  await waitForHtmx(page, async () => {
    await updateForm.mailingListProviderSelect().locator.selectOption('ravmesser')
  })
  await expect(updateForm.ravmesserListIdInput().locator).toBeVisible()
  await expect(updateForm.smooveListIdInput().locator).toBeHidden()
})

test('create ravmesser list from product form', async ({page}) => {
  await page.goto(new URL('/products/new', url()).href)

  const newProductModel = createNewProductPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  const newForm = newProductModel.form()
  await newForm.nameInput().locator.fill('Product With Created Ravmesser Lists')

  await newForm.ravmesserListIdCreateButton().locator.click()

  const dialog = newForm.ravmesserListCreateDialog()
  await expect(dialog.locator).toBeVisible()

  await dialog.listNameInput().locator.fill('My New Ravmesser List')
  await waitForHtmx(page, () => dialog.createButton().locator.click())

  await expect(dialog.locator).not.toBeVisible()
  // The fake derives new list ids from the fixture array, so only the shape is asserted
  await expect(newForm.ravmesserListIdInput().locator).toHaveValue(/^\d+: My New Ravmesser List$/)

  await newForm.createButton().locator.click()
  await page.waitForURL(updateProductModel.urlRegex)

  const updateForm = updateProductModel.form()
  await expect(updateForm.ravmesserListIdInput().locator).toHaveValue(
    /^\d+: My New Ravmesser List$/,
  )

  await expect(updateForm.ravmesserListIdCreateButton().locator).not.toBeVisible()
  await expect(updateForm.ravmesserRemovedListIdCreateButton().locator).toBeVisible()

  // Clearing the field brings the Create button back immediately (via CSS)
  await updateForm.ravmesserListIdInput().locator.fill('')
  await expect(updateForm.ravmesserListIdCreateButton().locator).toBeVisible()
})
