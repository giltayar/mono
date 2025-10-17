import {test, expect} from '@playwright/test'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {createViewSaleHistoryPageModel} from '../../page-model/sales/view-sale-history-page.model.ts'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {createSale} from '../../../src/domain/sale/model.ts'

const {url, sql, smooveIntegration} = setup(import.meta.url)

test('can view history', async ({page}) => {
  // Setup: Create student, sales event, products, and sale
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'John', lastName: 'Doe'}],
      emails: ['john.doe@example.com'],
      phones: [],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    sql(),
  )

  const productNumber = await createProduct(
    {
      name: 'Test Product',
      productType: 'recorded',
    },
    undefined,
    sql(),
  )

  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/test-sale',
      productsForSale: [productNumber],
    },
    undefined,
    sql(),
  )

  const saleNumber = await createSale(
    {
      salesEventNumber,
      studentNumber,
      finalSaleRevenue: 100,
      products: [{productNumber, quantity: 1, unitPrice: 100}],
    },
    undefined,
    sql(),
  )

  await page.goto(new URL(`/sales/${saleNumber}`, url()).href)

  const updateSaleModel = createUpdateSalePageModel(page)
  const viewSaleHistoryModel = createViewSaleHistoryPageModel(page)

  const updateHistory = updateSaleModel.history()
  const updateForm = updateSaleModel.form()

  await expect(updateHistory.items().locator).toHaveCount(1)
  await expect(updateHistory.items().item(0).locator).toContainText('create')

  await updateForm.finalSaleRevenueInput().locator.fill('150')

  await updateForm.updateButton().locator.click()

  await expect(updateHistory.items().locator).toHaveCount(2)
  await expect(updateHistory.items().item(0).locator).toContainText('update')
  await expect(updateHistory.items().item(1).locator).toContainText('create')
  await expect(updateHistory.items().item(0).link().locator).not.toBeVisible()

  await updateHistory.items().item(1).link().locator.click()

  await expect(page.url()).toMatch(viewSaleHistoryModel.urlRegex)

  const historyPage = viewSaleHistoryModel.history()
  const historyForm = viewSaleHistoryModel.form()

  await expect(historyPage.items().locator).toHaveCount(2)
  await expect(historyPage.items().item(0).locator).toContainText('update')
  await expect(historyPage.items().item(1).locator).toContainText('create')
  await expect(historyPage.items().item(1).link().locator).not.toBeVisible()

  await expect(historyForm.finalSaleRevenueInput().locator).toHaveValue('100')

  await historyPage.items().item(0).link().locator.click()

  await page.waitForURL(updateSaleModel.urlRegex)

  await expect(updateHistory.items().locator).toHaveCount(2)
  await expect(updateSaleModel.pageTitle().locator).toHaveText(/Update Sale \d+/)
  await expect(updateHistory.items().item(0).locator).toContainText('update')
  await expect(updateHistory.items().item(1).locator).toContainText('create')
  await expect(updateHistory.items().item(0).link().locator).not.toBeVisible()

  await expect(historyForm.finalSaleRevenueInput().locator).toHaveValue('150')
})

test('multiple sales have different histories', async ({page}) => {
  // Setup: Create students, sales event, products, and sales
  const student1Number = await createStudent(
    {
      names: [{firstName: 'Alice', lastName: 'Johnson'}],
      emails: ['alice.johnson@example.com'],
      phones: [],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    sql(),
  )

  const student2Number = await createStudent(
    {
      names: [{firstName: 'Bob', lastName: 'Williams'}],
      emails: ['bob.williams@example.com'],
      phones: [],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    sql(),
  )

  const productNumber = await createProduct(
    {
      name: 'Test Product',
      productType: 'recorded',
    },
    undefined,
    sql(),
  )

  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/test-sale',
      productsForSale: [productNumber],
    },
    undefined,
    sql(),
  )

  // Create first sale
  const sale1Number = await createSale(
    {
      salesEventNumber,
      studentNumber: student1Number,
      finalSaleRevenue: 100,
      products: [{productNumber, quantity: 1, unitPrice: 100}],
    },
    undefined,
    sql(),
  )

  await page.goto(new URL(`/sales/${sale1Number}`, url()).href)

  const updateSaleModel = createUpdateSalePageModel(page)

  // Get the first sale's URL
  const firstSaleUrl = await page.url()

  // Update first sale
  await updateSaleModel.form().finalSaleRevenueInput().locator.fill('150')
  await updateSaleModel.form().updateButton().locator.click()

  await expect(updateSaleModel.history().items().locator).toHaveCount(2)

  // Create second sale
  const sale2Number = await createSale(
    {
      salesEventNumber,
      studentNumber: student2Number,
      finalSaleRevenue: 200,
      products: [{productNumber, quantity: 2, unitPrice: 100}],
    },
    undefined,
    sql(),
  )

  await page.goto(new URL(`/sales/${sale2Number}`, url()).href)

  // Second sale should have only 1 history entry
  await expect(updateSaleModel.history().items().locator).toHaveCount(1)
  await expect(updateSaleModel.history().items().item(0).locator).toContainText('created')

  // Go back to first sale and verify it still has 2 history entries
  await page.goto(firstSaleUrl)

  await expect(updateSaleModel.history().items().locator).toHaveCount(2)
  await expect(updateSaleModel.history().items().item(0).locator).toContainText('update')
  await expect(updateSaleModel.history().items().item(1).locator).toContainText('create')
})
