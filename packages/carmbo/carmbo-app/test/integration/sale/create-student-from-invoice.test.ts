import {test, expect} from '@playwright/test'
import {createNewSalePageModel} from '../../page-model/sales/new-sale-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'

const {url, sql, smooveIntegration, academyIntegration, cardcomIntegration} = setup(import.meta.url)

test('create student from invoice and connect', async ({page}) => {
  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      smooveListId: 2,
      academyCourses: [1],
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
      productsForSale: [product1Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a cardcom invoice so fetchInvoiceInformation can find it
  const {cardcomInvoiceNumber} = await cardcomIntegration().createTaxInvoiceDocument(
    {
      cardcomCustomerId: 1,
      customerEmail: 'new-student@example.com',
      customerName: 'Jane Smith',
      customerPhone: '0501234567',
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 100 * 100,
      productsSold: [
        {
          productId: product1Number.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Product One',
        },
      ],
    },
    {sendInvoiceByMail: false},
  )

  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)

  await page.goto(new URL('/sales/new', url()).href)
  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  const newForm = newSaleModel.form()

  // Fill sales event first
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')

  // Fill cardcom invoice number and click "Create Student"
  await expect(newForm.createStudentFromInvoiceButton().locator).toBeVisible()
  await newForm.cardcomInvoiceNumberInput().locator.fill(cardcomInvoiceNumber.toString())
  await newForm.createStudentFromInvoiceButton().locator.click()
  await page.waitForLoadState('networkidle')

  // Student field should now be populated with the student from the invoice
  await expect(newForm.studentInput().locator).toHaveValue(/Jane Smith/)

  // Create Student button should be hidden now that a student is set
  await expect(newForm.createStudentFromInvoiceButton().locator).toBeHidden()

  // Fill in remaining required fields
  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).quantity().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.products().product(0).unitPrice().locator.fill('100')
  await newForm.products().product(0).unitPrice().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.finalSaleRevenueInput().locator.fill('100')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  // Save the sale
  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  const saleNumber = new URL(await page.url()).pathname.split('/').at(-1)
  await expect(updateSaleModel.pageTitle().locator).toHaveText(`Update Sale ${saleNumber}`)
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Disconnected from External Providers',
  )

  // Connect the sale
  await updateSaleModel.form().connectButton().locator.click()

  await expect(updateSaleModel.form().connectButton().locator).not.toBeVisible()
  await expect(updateSaleModel.pageTitle().locator).toHaveText(`Sale ${saleNumber}`)
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Verify academy enrollment
  expect(await academyIntegration().isStudentEnrolledInCourse('new-student@example.com', 1)).toBe(
    true,
  )

  // Verify smoove list
  expect(
    (await smooveIntegration().fetchContactsOfList(2)).map((contact) => contact.email),
  ).toEqual(['new-student@example.com'])
})

test('error when no invoice number and clicking Create Student', async ({page}) => {
  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
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
      productsForSale: [product1Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  const newSaleModel = createNewSalePageModel(page)

  await page.goto(new URL('/sales/new', url()).href)
  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  const newForm = newSaleModel.form()

  // Fill sales event but NOT the invoice number
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')

  // Click "Create Student" without filling the invoice number
  await newForm.createStudentFromInvoiceButton().locator.click()
  await page.waitForLoadState('networkidle')

  // Should show an error banner
  await expect(newSaleModel.header().errorBanner().locator).toBeVisible()
  await expect(newSaleModel.header().errorBanner().locator).toContainText(
    'Please fill in the Cardcom Invoice Number first',
  )

  // Student field should still be empty
  await expect(newForm.studentInput().locator).toHaveValue('')
})

test('find existing student from invoice and connect', async ({page}) => {
  // Create a student first
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'John', lastName: 'Doe'}],
      emails: ['john.doe@example.com'],
      phones: ['0501234567'],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
      smooveListId: 2,
      academyCourses: [1],
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
      productsForSale: [product1Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a cardcom invoice with the same email as the existing student
  const {cardcomInvoiceNumber} = await cardcomIntegration().createTaxInvoiceDocument(
    {
      cardcomCustomerId: 1,
      customerEmail: 'john.doe@example.com',
      customerName: 'John Doe',
      customerPhone: '0501234567',
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 50 * 100,
      productsSold: [
        {
          productId: product1Number.toString(),
          quantity: 1,
          unitPriceInCents: 50 * 100,
          productName: 'Product One',
        },
      ],
    },
    {sendInvoiceByMail: false},
  )

  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)

  await page.goto(new URL('/sales/new', url()).href)
  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  const newForm = newSaleModel.form()

  // Fill sales event
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')

  // Fill invoice number and click "Create Student"
  await newForm.cardcomInvoiceNumberInput().locator.fill(cardcomInvoiceNumber.toString())
  await newForm.createStudentFromInvoiceButton().locator.click()
  await page.waitForLoadState('networkidle')

  // Should find the existing student (not create a new one)
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)

  // Create Student button should be hidden now that a student is set
  await expect(newForm.createStudentFromInvoiceButton().locator).toBeHidden()

  // Fill remaining fields
  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).quantity().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.products().product(0).unitPrice().locator.fill('50')
  await newForm.products().product(0).unitPrice().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.finalSaleRevenueInput().locator.fill('50')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  // Save the sale
  await newForm.createButton().locator.click()
  await page.waitForURL(updateSaleModel.urlRegex)

  const saleNumber = new URL(await page.url()).pathname.split('/').at(-1)
  await expect(updateSaleModel.pageTitle().locator).toHaveText(`Update Sale ${saleNumber}`)

  // Connect the sale
  await updateSaleModel.form().connectButton().locator.click()

  await expect(updateSaleModel.form().connectButton().locator).not.toBeVisible()
  await expect(updateSaleModel.pageTitle().locator).toHaveText(`Sale ${saleNumber}`)
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Verify academy enrollment for the existing student
  expect(await academyIntegration().isStudentEnrolledInCourse('john.doe@example.com', 1)).toBe(true)
})

test('error when invoice number does not exist', async ({page}) => {
  const product1Number = await createProduct(
    {
      name: 'Product One',
      productType: 'recorded',
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
      productsForSale: [product1Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  const newSaleModel = createNewSalePageModel(page)

  await page.goto(new URL('/sales/new', url()).href)
  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  const newForm = newSaleModel.form()

  // Fill sales event
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')

  // Fill a non-existent invoice number and click "Create Student"
  await newForm.cardcomInvoiceNumberInput().locator.fill('99999')
  await newForm.createStudentFromInvoiceButton().locator.click()
  await page.waitForLoadState('networkidle')

  // Should show an error banner
  await expect(newSaleModel.header().errorBanner().locator).toBeVisible()
  await expect(newSaleModel.header().errorBanner().locator).toContainText(
    'Error creating student from invoice',
  )

  // Student field should still be empty
  await expect(newForm.studentInput().locator).toHaveValue('')
})
