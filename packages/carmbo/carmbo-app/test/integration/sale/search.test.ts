import {test, expect} from '@playwright/test'
import {createSaleListPageModel} from '../../page-model/sales/sale-list-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {createSale} from '../../../src/domain/sale/model.ts'

const {url, sql, smooveIntegration} = setup(import.meta.url)

test('searching sales', async ({page}) => {
  // Setup: Create students, sales events, products, and sales
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

  const student3Number = await createStudent(
    {
      names: [{firstName: 'Charlie', lastName: 'Brown'}],
      emails: ['charlie.brown@example.com'],
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

  const salesEvent1Number = await createSalesEvent(
    {
      name: 'Fall Sale',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-03-31'),
      landingPageUrl: 'https://example.com/fall',
      productsForSale: [productNumber],
    },
    undefined,
    sql(),
  )

  const salesEvent2Number = await createSalesEvent(
    {
      name: 'Summer Sale',
      fromDate: new Date('2025-06-01'),
      toDate: new Date('2025-08-31'),
      landingPageUrl: 'https://example.com/summer',
      productsForSale: [productNumber],
    },
    undefined,
    sql(),
  )

  const salesEvent3Number = await createSalesEvent(
    {
      name: 'Winter Sale',
      fromDate: new Date('2025-06-01'),
      toDate: new Date('2025-08-31'),
      landingPageUrl: 'https://example.com/winter',
      productsForSale: [productNumber],
    },
    undefined,
    sql(),
  )

  // Create sales
  const sale1Number = await createSale(
    {
      salesEventNumber: salesEvent3Number,
      studentNumber: student1Number,
      finalSaleRevenue: 100,
      products: [{productNumber, quantity: 1, unitPrice: 100}],
    },
    undefined,
    sql(),
  )

  await createSale(
    {
      salesEventNumber: salesEvent1Number,
      studentNumber: student2Number,
      finalSaleRevenue: 200,
      products: [{productNumber, quantity: 2, unitPrice: 100}],
    },
    undefined,
    sql(),
  )

  await createSale(
    {
      salesEventNumber: salesEvent2Number,
      studentNumber: student3Number,
      finalSaleRevenue: 150,
      products: [{productNumber, quantity: 1, unitPrice: 150}],
    },
    undefined,
    sql(),
  )

  await page.goto(new URL('/sales', url()).href)

  const saleListModel = createSaleListPageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)

  await expect(saleListModel.list().rows().locator).toHaveCount(3)

  await expect(saleListModel.list().rows().row(0).studentCell().locator).toHaveText('Charlie Brown')
  await expect(saleListModel.list().rows().row(0).eventCell().locator).toHaveText('Summer Sale')

  await expect(saleListModel.list().rows().row(1).studentCell().locator).toHaveText('Bob Williams')
  await expect(saleListModel.list().rows().row(1).eventCell().locator).toHaveText('Fall Sale')

  await expect(saleListModel.list().rows().row(2).studentCell().locator).toHaveText('Alice Johnson')
  await expect(saleListModel.list().rows().row(2).eventCell().locator).toHaveText('Winter Sale')

  // Test search by student name
  await saleListModel.search().queryInput().locator.fill('Alice')

  await expect(saleListModel.list().rows().locator).toHaveCount(1)
  await expect(saleListModel.list().rows().row(0).studentCell().locator).toHaveText('Alice Johnson')

  // Test search by event name
  await saleListModel.search().queryInput().locator.fill('er')

  await expect(saleListModel.list().rows().locator).toHaveCount(2)
  await expect(saleListModel.list().rows().row(0).eventCell().locator).toHaveText('Summer Sale')
  await expect(saleListModel.list().rows().row(1).eventCell().locator).toHaveText('Winter Sale')

  // Clear search
  await saleListModel.search().queryInput().locator.fill('')

  await expect(saleListModel.list().rows().locator).toHaveCount(3)

  // Archive one sale
  await page.goto(new URL(`/sales/${sale1Number}`, url()).href)
  await updateSaleModel.form().deleteButton().locator.click()
  await expect(updateSaleModel.form().restoreButton().locator).toBeVisible()

  await page.goto(new URL('/sales', url()).href)

  // Search by student name - archived sale should not appear
  await saleListModel.search().queryInput().locator.fill('Alice')

  await expect(saleListModel.list().rows().locator).toHaveCount(0)

  // Show archived
  await saleListModel.search().showArchivedCheckbox().locator.click()

  await expect(saleListModel.list().rows().locator).toHaveCount(1)
  await expect(saleListModel.list().rows().row(0).studentCell().locator).toHaveText('Alice Johnson')

  // Clear search and uncheck archived
  await saleListModel.search().queryInput().locator.fill('')
  await saleListModel.search().showArchivedCheckbox().locator.click()

  // Should show only non-archived sales
  await expect(saleListModel.list().rows().locator).toHaveCount(2)
  await expect(saleListModel.list().rows().row(0).studentCell().locator).toHaveText('Charlie Brown')
  await expect(saleListModel.list().rows().row(1).studentCell().locator).toHaveText('Bob Williams')
})
