import {test, expect} from '@playwright/test'
import {setup} from '../../../common/setup.ts'
import {createProduct} from '../../../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../../../src/domain/sales-event/model/model.ts'
import {createStudentListPageModel} from '../../../../page-model/students/student-list-page.model.ts'
import {createSaleListPageModel} from '../../../../page-model/sales/sale-list-page.model.ts'
import {createUpdateStudentPageModel} from '../../../../page-model/students/update-student-page.model.ts'
import {createUpdateSalePageModel} from '../../../../page-model/sales/update-sale-page.model.ts'
import type {TaxInvoiceInformation} from '@giltayar/carmel-tools-cardcom-integration/service'
import {cardcomWebhookUrl} from '../../common/cardcom-webhook.ts'
import {createSaleProvidersPageModel} from '../../../../page-model/sales/sale-providers-page.model.ts'
const {url, sql, cardcomIntegration} = setup(import.meta.url)

test('cardcom sale creates student, sale, and integrations', async ({page}) => {
  const academyCourseId = 1
  const smooveListId = 2

  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      academyCourses: [academyCourseId],
      smooveListId: smooveListId,
    },
    undefined,
    new Date(),
    sql(),
  )

  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'challenge',
      academyCourses: [33],
    },
    undefined,
    new Date(),
    sql(),
  )

  const product3Number = await createProduct(
    {
      name: 'Product Three',
      productType: 'club',
    },
    undefined,
    new Date(),
    sql(),
  )

  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/test-sale',
      productsForSale: [product1Number, product2Number, product3Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  const customerEmail = 'test-customer@example.com'
  const customerName = 'John Doe'
  const customerPhone = '0501234567'

  await cardcomIntegration()._test_simulateCardcomSale(
    {
      productsSold: [
        {
          productId: product1Number.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Product One',
        },
        {
          productId: product2Number.toString(),
          quantity: 2,
          unitPriceInCents: 50 * 100,
          productName: 'Product Two',
        },
      ],
      customerEmail,
      customerName,
      customerPhone,
      cardcomCustomerId: 1776,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 21 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
  )

  await page.goto(new URL('/students', url()).href)

  const studentListModel = createStudentListPageModel(page)
  const studentRows = studentListModel.list().rows()

  await expect(studentRows.locator).toHaveCount(1)

  const firstStudentRow = studentRows.row(0)
  await expect(firstStudentRow.nameCell().locator).toHaveText('John Doe')
  await expect(firstStudentRow.emailCell().locator).toHaveText(customerEmail)
  await expect(firstStudentRow.phoneCell().locator).toHaveText(customerPhone)

  // Navigate to student detail page to verify no Cardcom customer ID field (since none was provided)
  await firstStudentRow.idLink().locator.click()
  await page.waitForURL(/\/students\/\d+$/)

  const updateStudentModel = createUpdateStudentPageModel(page)

  await expect(updateStudentModel.form().cardcomCustomerIdsInput().locator).toHaveValue('1776')

  await page.goto(new URL('/sales', url()).href)

  const saleListModel = createSaleListPageModel(page)
  const saleRows = saleListModel.list().rows()

  await expect(saleRows.locator).toHaveCount(1)

  const firstSaleRow = saleRows.row(0)
  await expect(firstSaleRow.eventCell().locator).toHaveText('Test Sales Event')
  await expect(firstSaleRow.studentCell().locator).toHaveText('John Doe')
  await expect(firstSaleRow.revenueCell().locator).toContainText('21')
  await expect(firstSaleRow.productsCell().locator).toContainText('Product One')
  await expect(firstSaleRow.productsCell().locator).toContainText('Product Two')

  const taxInvoiceDocument = await cardcomIntegration().fetchInvoiceInformation(1)

  expect(taxInvoiceDocument).toBeDefined()

  await expect(taxInvoiceDocument).toMatchObject({
    customerName: 'John Doe',
    customerEmail: 'test-customer@example.com',
    customerPhone: '0501234567',
    productsSold: [
      {
        productId: product1Number.toString(),
        productName: 'Product One',
        quantity: 1,
        unitPriceInCents: 10000,
      },
      {
        productId: product2Number.toString(),
        productName: 'Product Two',
        quantity: 2,
        unitPriceInCents: 5000,
      },
    ],
    transactionRevenueInCents: 2100,
  } as Omit<TaxInvoiceInformation, 'transactionDate'>)

  // Click on the sale to view the sale detail page
  await firstSaleRow.idLink().locator.click()
  await page.waitForURL(/\/sales\/\d+$/)

  const saleDetailModel = createUpdateSalePageModel(page)

  await expect(saleDetailModel.pageTitle().locator).toHaveText('Sale 1')
  await expect(saleDetailModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )
  await expect(saleDetailModel.form().reconnectButton().locator).toBeVisible()
  await expect(saleDetailModel.form().connectButton().locator).not.toBeVisible()
  await expect(saleDetailModel.form().restoreButton().locator).not.toBeVisible()
  await expect(saleDetailModel.form().deleteButton().locator).not.toBeVisible()
  await expect(saleDetailModel.form().discardButton().locator).not.toBeVisible()

  // Verify sale details
  await expect(saleDetailModel.form().salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await expect(saleDetailModel.form().studentInput().locator).toHaveValue('1: John Doe')
  await expect(saleDetailModel.form().finalSaleRevenueInput().locator).toHaveValue('21')

  await expect(saleDetailModel.form().cardcomInvoiceNumberInput().locator).toHaveValue('1')
  await expect(saleDetailModel.form().viewInvoiceLink().locator).toHaveAttribute(
    'href',
    'http://invoice-document.example.com/1',
  )

  // Verify products in the sale detail page
  const products = saleDetailModel.form().products()
  await expect(products.locator).toHaveCount(2)

  const product1 = products.product(0)
  await expect(product1.title().locator).toContainText('Product One')
  await expect(product1.locator).toContainText(`${product1Number}: Product One`)
  await expect(product1.quantity().locator).toHaveValue('1')
  await expect(product1.unitPrice().locator).toHaveValue('100')

  const product2 = products.product(1)
  await expect(product2.title().locator).toContainText('Product Two')
  await expect(product2.quantity().locator).toHaveValue('2')
  await expect(product2.unitPrice().locator).toHaveValue('50')

  await expect(saleDetailModel.history().items().item(0).locator).toHaveText(/created/)

  // Navigate to the providers page to verify connections
  await page.goto(new URL('/sales/1/providers', url()).href)
  await page.waitForURL(/\/sales\/1\/providers$/)

  const providersPageModel = createSaleProvidersPageModel(page)

  // Verify page title
  await expect(providersPageModel.pageTitle().locator).toContainText('Sale 1')

  // Verify we have the expected product cards (2 products with integrations)
  const productCards = providersPageModel.productCards()
  await expect(productCards.locator).toHaveCount(2)

  // Check first product (Product One) - has academy course and smoove list
  const product1Card = productCards.card(0)
  await expect(product1Card.title().locator).toContainText('Product One')

  // Go back to sale detail page
  await page.goto(new URL('/sales/1', url()).href)
  await page.waitForURL(/\/sales\/1$/)

  // Verify sale details
  await expect(saleDetailModel.form().salesEventInput().locator).toHaveValue(
    `${salesEventNumber}: Test Sales Event`,
  )
  await expect(saleDetailModel.form().studentInput().locator).toHaveValue('1: John Doe')
  await expect(saleDetailModel.form().finalSaleRevenueInput().locator).toHaveValue('21')

  await expect(saleDetailModel.form().cardcomInvoiceNumberInput().locator).toHaveValue('1')
  await expect(saleDetailModel.form().viewInvoiceLink().locator).toHaveAttribute(
    'href',
    'http://invoice-document.example.com/1',
  )

  // Verify products in the sale detail page
  const productsX = saleDetailModel.form().products()
  await expect(productsX.locator).toHaveCount(2)

  const product1x = productsX.product(0)
  await expect(product1x.title().locator).toContainText('Product One')
  await expect(product1x.locator).toContainText(`${product1Number}: Product One`)
  await expect(product1x.quantity().locator).toHaveValue('1')
  await expect(product1x.unitPrice().locator).toHaveValue('100')

  const product2x = productsX.product(1)
  await expect(product2x.title().locator).toContainText('Product Two')
  await expect(product2x.quantity().locator).toHaveValue('2')
  await expect(product2x.unitPrice().locator).toHaveValue('50')

  await page.goto(new URL(`/students/1`, url()).href)

  await expect(updateStudentModel.pageTitle().locator).toHaveText(`Update Student 1`)

  const studentForm = updateStudentModel.form()
  await expect(studentForm.cardcomCustomerIdsInput().locator).toHaveValue('1776')

  // Verify notes can be updated on a connected cardcom sale
  await page.goto(new URL('/sales/1', url()).href)
  await page.waitForURL(/\/sales\/1$/)

  await saleDetailModel.form().notesInput().locator.fill('Notes on a cardcom sale')
  await saleDetailModel.form().updateButton().locator.click()

  await page.waitForURL(/\/sales\/1$/)
  await expect(saleDetailModel.form().notesInput().locator).toHaveValue('Notes on a cardcom sale')
})
