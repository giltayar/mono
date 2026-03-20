import {test, expect} from '@playwright/test'
import {createProductListPageModel} from '../../page-model/products/product-list-page.model.ts'
import {setup} from '../common/setup.ts'
import {createProduct, type NewProduct} from '../../../src/domain/product/model.ts'
import {createUpdateProductPageModel} from '../../page-model/products/update-product-page.model.ts'
import type {Sql} from 'postgres'

const {url, sql} = setup(import.meta.url)

test('searching products', async ({page}) => {
  test.slow()

  const {notableNumbers} = await seedProducts(sql())

  await page.goto(new URL('/products', url()).href)

  const productListModel = createProductListPageModel(page)
  const updateProductModel = createUpdateProductPageModel(page)

  // --- Pagination: first page loads 50 (descending order) ---
  await expect(productListModel.list().rows().locator).toHaveCount(50)

  // First row = last-created product (Prod-193, product 200)
  await expect(productListModel.list().rows().row(0).idLink().locator).toHaveText('200')
  await expect(productListModel.list().rows().row(0).nameCell().locator).toHaveText('Prod-193')

  // --- Infinite scroll ---
  await productListModel.list().rows().row(49).locator.scrollIntoViewIfNeeded()
  await expect(productListModel.list().rows().locator).toHaveCount(100)

  await productListModel.list().rows().row(99).locator.scrollIntoViewIfNeeded()
  await expect(productListModel.list().rows().locator).toHaveCount(150)

  await productListModel.list().rows().row(149).locator.scrollIntoViewIfNeeded()
  await expect(productListModel.list().rows().locator).toHaveCount(200)

  // --- Search by name: "Alpha" → 1 hit ---
  await productListModel.search().queryInput().locator.fill('Alpha')
  await productListModel.search().queryInput().locator.press('Enter')

  await expect(productListModel.list().rows().locator).toHaveCount(1)
  await expect(productListModel.list().rows().row(0).idLink().locator).toHaveText(
    String(notableNumbers[0]),
  )
  await expect(productListModel.list().rows().row(0).nameCell().locator).toContainText('Alpha')

  // --- Search by type: "recorded" → 3 hits (descending: Eta, Epsilon, Alpha) ---
  await productListModel.search().queryInput().locator.fill('recorded')
  await productListModel.search().queryInput().locator.press('Enter')

  await expect(productListModel.list().rows().locator).toHaveCount(RECORDED_NOTABLE_COUNT)
  await expect(productListModel.list().rows().row(0).typeCell().locator).toContainText('recorded')

  // --- Archive / restore ---
  // Archive "Alpha Course" (notable #0) by navigating to its page
  await page.goto(url().href + `products/${notableNumbers[0]}`)
  await page.waitForURL(updateProductModel.urlRegex)

  await updateProductModel.form().deleteButton().locator.click()
  await expect(updateProductModel.form().restoreButton().locator).toBeVisible()

  // Search for "Alpha" — archived product is excluded, so 0 results
  await page.goto(new URL('/products', url()).href)
  await productListModel.search().queryInput().locator.fill('Alpha')
  await productListModel.search().queryInput().locator.press('Enter')

  await expect(productListModel.list().rows().locator).toHaveCount(0)

  // Check "show archived" — archived product reappears
  await productListModel.search().showArchivedCheckbox().locator.check()
  await expect(productListModel.list().rows().locator).toHaveCount(1)
  await expect(productListModel.list().rows().row(0).nameCell().locator).toContainText('Alpha')
})

async function seedProducts(sql: Sql): Promise<{notableNumbers: number[]}> {
  const notableNumbers: number[] = []

  for (const {product} of NOTABLE_PRODUCTS) {
    const num = await createProduct(product, undefined, new Date(), sql)
    notableNumbers.push(num)
  }

  for (let i = 1; i <= FILLER_COUNT; i++) {
    const padded = String(i).padStart(3, '0')
    await createProduct(
      {name: `Prod-${padded}`, productType: 'challenge'},
      undefined,
      new Date(),
      sql,
    )
  }

  return {notableNumbers}
}

/**
 * Notable products with carefully chosen data for search/content assertions.
 * Created first, so they get the lowest product numbers.
 *
 * Filler products all have type 'challenge' and names like "Prod-NNN",
 * so they won't collide with search terms used for notables.
 */
const NOTABLE_PRODUCTS: {purpose: string; product: NewProduct}[] = [
  {
    purpose: 'name search target + archive target',
    product: {name: 'Alpha Course', productType: 'recorded'},
  },
  {
    purpose: 'second unique name',
    product: {name: 'Beta Workshop', productType: 'challenge'},
  },
  {
    purpose: 'type search: bundle',
    product: {name: 'Gamma Bundle', productType: 'bundle'},
  },
  {
    purpose: 'type search: club',
    product: {name: 'Delta Club', productType: 'club'},
  },
  {
    purpose: 'second recorded product',
    product: {name: 'Epsilon Pack', productType: 'recorded'},
  },
  {
    purpose: 'padding',
    product: {name: 'Zeta Suite', productType: 'challenge'},
  },
  {
    purpose: 'third recorded product',
    product: {name: 'Eta Module', productType: 'recorded'},
  },
]

const TOTAL_PRODUCTS = 200
const FILLER_COUNT = TOTAL_PRODUCTS - NOTABLE_PRODUCTS.length
const RECORDED_NOTABLE_COUNT = NOTABLE_PRODUCTS.filter(
  (n) => n.product.productType === 'recorded',
).length
