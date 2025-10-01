import {test, expect} from '@playwright/test'
import {createProductListPageModel} from '../page-model/products/product-list-page.model.ts'
import {setup} from '../common/setup.ts'
import {TEST_seedProducts} from '../../../src/products/model.ts'
import {createUpdateProductPageModel} from '../page-model/products/update-product-page.model.ts'

const {url, sql} = setup(import.meta.url)

test('searching products', async ({page}) => {
  test.slow()

  await TEST_seedProducts(sql(), 200)

  await page.goto(new URL('/products', url()).href)

  const productListModel = createProductListPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  await expect(productListModel.list().rows().locator).toHaveCount(50)

  await expect(productListModel.list().rows().row(0).idLink().locator).toHaveText('1')
  await expect(productListModel.list().rows().row(0).nameCell().locator).toContainText('')

  // test infinite scroll

  await productListModel.list().rows().row(49).locator.scrollIntoViewIfNeeded()
  await expect(productListModel.list().rows().locator).toHaveCount(100)

  await productListModel.list().rows().row(99).locator.scrollIntoViewIfNeeded()
  await expect(productListModel.list().rows().locator).toHaveCount(150)

  await productListModel.list().rows().row(149).locator.scrollIntoViewIfNeeded()
  await expect(productListModel.list().rows().locator).toHaveCount(200)

  // test search by name

  const firstProductName = await productListModel
    .list()
    .rows()
    .row(0)
    .nameCell()
    .locator.innerText()
  const searchTerm = firstProductName.split(' ')[0].substring(0, 4)

  await productListModel.search().queryInput().locator.fill(searchTerm)
  await productListModel.search().queryInput().locator.press('Enter')

  const rowCountAfterSearch = await productListModel.list().rows().locator.count()
  expect(rowCountAfterSearch).toBeGreaterThan(0)
  await expect(productListModel.list().rows().row(0).nameCell().locator).toContainText(searchTerm)

  // test search by type

  await productListModel.search().queryInput().locator.fill('recorded')
  await productListModel.search().queryInput().locator.press('Enter')

  const rowCountAfterTypeSearch = await productListModel.list().rows().locator.count()
  expect(rowCountAfterTypeSearch).toBeGreaterThan(0)
  await expect(productListModel.list().rows().row(0).typeCell().locator).toContainText('recorded')

  // test archived products

  await productListModel.search().queryInput().locator.fill('')
  await page.reload()

  await productListModel.list().rows().row(0).idLink().locator.click()

  await page.waitForURL(updateProductModel.urlRegex)

  await updateProductModel.form().deleteButton().locator.click()
  await expect(updateProductModel.form().restoreButton().locator).toBeVisible()

  await page.goto(new URL('/products', url()).href)

  await expect(productListModel.list().rows().locator).toHaveCount(50)

  await productListModel.search().showArchivedCheckbox().locator.check()

  await page.waitForLoadState('networkidle')

  await expect(productListModel.list().rows().locator).toHaveCount(50)
})
