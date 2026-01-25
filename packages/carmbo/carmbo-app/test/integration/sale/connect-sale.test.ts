import {test, expect} from '@playwright/test'
import {createNewSalePageModel} from '../../page-model/sales/new-sale-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import type {TaxInvoiceInformation} from '@giltayar/carmel-tools-cardcom-integration/service'
import {createUpdateStudentPageModel} from '../../page-model/students/update-student-page.model.ts'

const {url, sql, smooveIntegration, academyIntegration, cardcomIntegration} = setup(import.meta.url)

test('create sale then connect it', async ({page}) => {
  // Setup: Create a student, sales event, and products
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'John', lastName: 'Doe'}],
      emails: ['john.doe@example.com'],
      phones: ['1234567890'],
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

  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'challenge',
      smooveListId: 10,
      academyCourses: [33, 777],
    },
    undefined,
    new Date(),
    sql(),
  )

  const product3Number = await createProduct(
    {
      name: 'Product Three',
      productType: 'recorded',
      smooveListId: 20,
      academyCourses: [888],
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

  await page.goto(new URL('/sales', url()).href)

  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  // Navigate to create new sale page
  await page.goto(new URL('/sales/new', url()).href)

  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  // Fill the new sale form
  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)

  await newForm.products().product(0).quantity().locator.fill('2')
  await newForm.products().product(0).quantity().locator.blur()
  await page.waitForLoadState('networkidle')
  await expect(newForm.products().product(0).quantity().locator).toHaveValue('2')
  await newForm.products().product(0).unitPrice().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.blur()
  await page.waitForLoadState('networkidle')
  await expect(newForm.products().product(0).unitPrice().locator).toHaveValue('1')
  await newForm.products().product(1).quantity().locator.fill('1')
  await newForm.products().product(1).quantity().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.products().product(1).unitPrice().locator.fill('3')
  await newForm.products().product(1).unitPrice().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.products().product(2).quantity().locator.fill('0')
  await newForm.products().product(2).quantity().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.products().product(2).unitPrice().locator.fill('5')
  await newForm.products().product(2).unitPrice().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.finalSaleRevenueInput().locator.fill('27')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  // Save the sale
  await newForm.createButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateSaleModel.urlRegex)

  const saleNumber = new URL(await page.url()).pathname.split('/').at(-1)

  await expect(updateSaleModel.pageTitle().locator).toHaveText(`Update Sale ${saleNumber}`)

  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Disconnected from External Providers',
  )

  await updateSaleModel.form().connectButton().locator.click()

  await expect(updateSaleModel.form().connectButton().locator).not.toBeVisible()
  await expect(updateSaleModel.form().updateButton().locator).not.toBeVisible()
  await expect(updateSaleModel.form().restoreButton().locator).not.toBeVisible()
  await expect(updateSaleModel.form().discardButton().locator).not.toBeVisible()

  await expect(updateSaleModel.pageTitle().locator).toHaveText(`Sale ${saleNumber}`)
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  await expect(updateSaleModel.form().viewInvoiceLink().locator).toHaveAttribute(
    'href',
    `http://invoice-document.example.com/1`,
  )

  const taxInvoiceDocument = await cardcomIntegration()._test_getTaxInvoiceDocument('1')

  expect(taxInvoiceDocument).toBeDefined()

  await expect(taxInvoiceDocument).toMatchObject({
    customerName: 'John Doe',
    customerEmail: 'john.doe@example.com',
    customerPhone: '1234567890',
    productsSold: [
      {
        productId: product1Number.toString(),
        productName: 'Product One',
        quantity: 2,
        unitPriceInCents: 100,
      },
      {
        productId: product2Number.toString(),
        productName: 'Product Two',
        quantity: 1,
        unitPriceInCents: 300,
      },
      {
        productId: product3Number.toString(),
        productName: 'Product Three',
        quantity: 0,
        unitPriceInCents: 500,
      },
    ],
    transactionRevenueInCents: 2700,
  } as Omit<TaxInvoiceInformation, 'transactionDate'>)

  expect(taxInvoiceDocument?.transactionDescription).toBeUndefined()

  expect(await academyIntegration().isStudentEnrolledInCourse('john.doe@example.com', 1)).toBe(true)
  expect(await academyIntegration().isStudentEnrolledInCourse('john.doe@example.com', 33)).toBe(
    true,
  )
  expect(await academyIntegration().isStudentEnrolledInCourse('john.doe@example.com', 777)).toBe(
    true,
  )
  expect(await academyIntegration().isStudentEnrolledInCourse('john.doe@example.com', 888)).toBe(
    false,
  )

  expect(
    (await smooveIntegration().fetchContactsOfList(2)).map((contact) => contact.email),
  ).toEqual(['john.doe@example.com'])
  expect(
    (await smooveIntegration().fetchContactsOfList(10)).map((contact) => contact.email),
  ).toEqual(['john.doe@example.com'])
  expect(
    (await smooveIntegration().fetchContactsOfList(20)).map((contact) => contact.email),
  ).toEqual([])

  await page.goto(new URL(`/students/${studentNumber}`, url()).href)

  await expect(updateStudentModel.pageTitle().locator).toHaveText(`Update Student ${studentNumber}`)

  const studentForm = updateStudentModel.form()
  await expect(studentForm.cardcomCustomerIdsInput().locator).toHaveValue(
    taxInvoiceDocument?.cardcomCustomerId?.toString() ?? '',
  )
})

test('create sale with existing cardcom invoice id, then connect it', async ({page}) => {
  // Setup: Create a student, sales event, and products
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'John', lastName: 'Doe'}],
      emails: ['john.doe@example.com'],
      phones: ['1234567890'],
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

  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'challenge',
      smooveListId: 10,
      academyCourses: [33, 777],
    },
    undefined,
    new Date(),
    sql(),
  )

  const {cardcomInvoiceNumber} = await cardcomIntegration().createTaxInvoiceDocument(
    {
      cardcomCustomerId: 1,
      customerEmail: 'john.doe@example.com',
      customerName: 'John Doe',
      customerPhone: '1234567890',
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 100,
      productsSold: [
        {
          productId: product1Number.toString(),
          quantity: 2,
          unitPriceInCents: 100,
          productName: 'Product One',
        },
        {
          productId: product2Number.toString(),
          quantity: 1,
          unitPriceInCents: 300,
          productName: 'Product Two',
        },
      ],
    },
    {sendInvoiceByMail: false},
  )

  const salesEventNumber = await createSalesEvent(
    {
      name: 'Test Sales Event',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-12-31'),
      landingPageUrl: 'https://example.com/test-sale',
      productsForSale: [product1Number, product2Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  await page.goto(new URL('/sales', url()).href)

  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  // Navigate to create new sale page
  await page.goto(new URL('/sales/new', url()).href)

  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  // Fill the new sale form
  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.products().product(0).quantity().locator.fill('2')
  await newForm.products().product(0).quantity().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.products().product(0).unitPrice().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.products().product(1).quantity().locator.fill('1')
  await newForm.products().product(1).quantity().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.products().product(1).unitPrice().locator.fill('3')
  await newForm.products().product(1).unitPrice().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.cardcomInvoiceNumberInput().locator.fill(cardcomInvoiceNumber.toString())
  await newForm.finalSaleRevenueInput().locator.fill('777')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  // Save the sale
  await newForm.createButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateSaleModel.urlRegex)

  const saleNumber = new URL(await page.url()).pathname.split('/').at(-1)

  await expect(updateSaleModel.pageTitle().locator).toHaveText(`Update Sale ${saleNumber}`)

  await updateSaleModel.form().connectButton().locator.click()

  await expect(updateSaleModel.form().connectButton().locator).not.toBeVisible()
  await expect(updateSaleModel.form().updateButton().locator).not.toBeVisible()
  await expect(updateSaleModel.form().restoreButton().locator).not.toBeVisible()
  await expect(updateSaleModel.form().discardButton().locator).not.toBeVisible()

  await expect(updateSaleModel.pageTitle().locator).toHaveText(`Sale ${saleNumber}`)

  await expect(updateSaleModel.form().cardcomInvoiceNumberInput().locator).toHaveValue(
    cardcomInvoiceNumber.toString(),
  )

  await expect(updateSaleModel.form().viewInvoiceLink().locator).toHaveAttribute(
    'href',
    `http://invoice-document.example.com/${cardcomInvoiceNumber}`,
  )
  await expect(updateSaleModel.form().finalSaleRevenueInput().locator).toHaveValue('777')

  const taxInvoiceDocument = await cardcomIntegration()._test_getTaxInvoiceDocument(
    cardcomInvoiceNumber.toString(),
  )

  expect(taxInvoiceDocument).toBeDefined()

  await expect(taxInvoiceDocument).toMatchObject({
    customerName: 'John Doe',
    customerEmail: 'john.doe@example.com',
    customerPhone: '1234567890',
    productsSold: [
      {
        productId: product1Number.toString(),
        productName: 'Product One',
        quantity: 2,
        unitPriceInCents: 100,
      },
      {
        productId: product2Number.toString(),
        productName: 'Product Two',
        quantity: 1,
        unitPriceInCents: 300,
      },
    ],
    transactionRevenueInCents: 100,
  } as Omit<TaxInvoiceInformation, 'transactionDate'>)

  expect(await academyIntegration().isStudentEnrolledInCourse('john.doe@example.com', 1)).toBe(true)
  expect(await academyIntegration().isStudentEnrolledInCourse('john.doe@example.com', 33)).toBe(
    true,
  )
  expect(await academyIntegration().isStudentEnrolledInCourse('john.doe@example.com', 777)).toBe(
    true,
  )

  expect(
    (await smooveIntegration().fetchContactsOfList(2)).map((contact) => contact.email),
  ).toEqual(['john.doe@example.com'])
  expect(
    (await smooveIntegration().fetchContactsOfList(10)).map((contact) => contact.email),
  ).toEqual(['john.doe@example.com'])

  await page.goto(new URL(`/students/${studentNumber}`, url()).href)

  await expect(updateStudentModel.pageTitle().locator).toHaveText(`Update Student ${studentNumber}`)

  const studentForm = updateStudentModel.form()
  await expect(studentForm.cardcomCustomerIdsInput().locator).toBeHidden()
})

test('connect sale then reconnect it', async ({page}) => {
  // Setup: Create a student, sales event, and products
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'John', lastName: 'Doe'}],
      emails: ['john.doe@example.com'],
      phones: ['1234567890'],
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

  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'challenge',
      smooveListId: 10,
      academyCourses: [33, 777],
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
      productsForSale: [product1Number, product2Number],
    },
    undefined,
    new Date(),
    sql(),
  )

  await page.goto(new URL('/sales', url()).href)

  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  // Navigate to create new sale page
  await page.goto(new URL('/sales/new', url()).href)

  // Fill the new sale form
  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await expect(newForm.studentInput().locator).toHaveValue(`${studentNumber}: John Doe`)

  await newForm.products().product(0).quantity().locator.fill('2')
  await newForm.products().product(0).quantity().locator.blur()
  await page.waitForLoadState('networkidle')
  await expect(newForm.products().product(0).quantity().locator).toHaveValue('2')
  await newForm.products().product(0).unitPrice().locator.fill('1')
  await newForm.products().product(0).unitPrice().locator.blur()
  await page.waitForLoadState('networkidle')
  await expect(newForm.products().product(0).unitPrice().locator).toHaveValue('1')
  await newForm.products().product(1).quantity().locator.fill('1')
  await newForm.products().product(1).quantity().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.products().product(1).unitPrice().locator.fill('3')
  await newForm.products().product(1).unitPrice().locator.blur()
  await page.waitForLoadState('networkidle')
  await expect(newForm.products().product(1).unitPrice().locator).toHaveValue('3')

  await newForm.finalSaleRevenueInput().locator.fill('27')
  await newForm.finalSaleRevenueInput().locator.blur()
  await page.waitForLoadState('networkidle')

  // Save the sale
  await newForm.createButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateSaleModel.urlRegex)

  await expect(updateSaleModel.history().items().locator).toHaveCount(1)

  await updateSaleModel.form().connectButton().locator.click()

  await expect(updateSaleModel.history().items().locator).toHaveCount(3)

  await expect(updateSaleModel.form().reconnectButton().locator).toBeVisible()
  await expect(updateSaleModel.form().connectButton().locator).not.toBeVisible()
  await expect(updateSaleModel.form().updateButton().locator).not.toBeVisible()
  await expect(updateSaleModel.form().restoreButton().locator).not.toBeVisible()
  await expect(updateSaleModel.form().discardButton().locator).not.toBeVisible()

  const smooveId = (
    await smooveIntegration().fetchSmooveContact('john.doe@example.com', {by: 'email'})
  ).id!
  await smooveIntegration().changeContactLinkedLists(smooveId, {
    unsubscribeFrom: [2],
    subscribeTo: [],
  })
  expect(await smooveIntegration().fetchContactsOfList(2)).toEqual([])

  await academyIntegration().removeContactFromAccount('john.doe@example.com')
  expect(await academyIntegration().isStudentEnrolledInCourse('john.doe@example.com', 1)).toBe(
    false,
  )

  await updateSaleModel.form().reconnectButton().locator.click()
  await expect(updateSaleModel.history().items().locator).toHaveCount(5)
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  const taxInvoiceDocument = await cardcomIntegration()._test_getTaxInvoiceDocument('1')

  expect(taxInvoiceDocument).toBeDefined()

  await expect(taxInvoiceDocument).toMatchObject({
    customerName: 'John Doe',
    customerEmail: 'john.doe@example.com',
    customerPhone: '1234567890',
    productsSold: [
      {
        productId: product1Number.toString(),
        productName: 'Product One',
        quantity: 2,
        unitPriceInCents: 100,
      },
      {
        productId: product2Number.toString(),
        productName: 'Product Two',
        quantity: 1,
        unitPriceInCents: 300,
      },
    ],
    transactionRevenueInCents: 2700,
  } as Omit<TaxInvoiceInformation, 'transactionDate'>)

  expect(await academyIntegration().isStudentEnrolledInCourse('john.doe@example.com', 1)).toBe(true)
  expect(await academyIntegration().isStudentEnrolledInCourse('john.doe@example.com', 33)).toBe(
    true,
  )
  expect(await academyIntegration().isStudentEnrolledInCourse('john.doe@example.com', 777)).toBe(
    true,
  )

  expect(
    (await smooveIntegration().fetchContactsOfList(2)).map((contact) => contact.email),
  ).toEqual(['john.doe@example.com'])
  expect(
    (await smooveIntegration().fetchContactsOfList(10)).map((contact) => contact.email),
  ).toEqual(['john.doe@example.com'])

  await page.goto(new URL(`/students/${studentNumber}`, url()).href)

  await expect(updateStudentModel.pageTitle().locator).toHaveText(`Update Student ${studentNumber}`)

  const studentForm = updateStudentModel.form()
  await expect(studentForm.cardcomCustomerIdsInput().locator).toBeHidden()
})

test('create sale with transaction description then connect it', async ({page}) => {
  // Setup: Create a student, sales event, and products
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'Jane', lastName: 'Doe'}],
      emails: ['jane.doe@example.com'],
      phones: ['0501234567'],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  const productNumber = await createProduct(
    {
      name: 'Test Product',
      productType: 'recorded',
      smooveListId: 5,
      academyCourses: [100],
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
      productsForSale: [productNumber],
    },
    undefined,
    new Date(),
    sql(),
  )

  const newSaleModel = createNewSalePageModel(page)
  const updateSaleModel = createUpdateSalePageModel(page)

  // Navigate to create new sale page
  await page.goto(new URL('/sales/new', url()).href)

  await expect(newSaleModel.pageTitle().locator).toHaveText('New Sale')

  // Fill the new sale form with transaction description
  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.products().product(0).quantity().locator.fill('1')
  await newForm.products().product(0).quantity().locator.blur()
  await page.waitForLoadState('networkidle')
  await newForm.products().product(0).unitPrice().locator.fill('50')
  await newForm.products().product(0).unitPrice().locator.blur()
  await page.waitForLoadState('networkidle')

  await newForm.finalSaleRevenueInput().locator.fill('50')
  await newForm.transactionDescriptionInput().locator.fill('שולם בהעברה בנקאית')

  // Save the sale
  await newForm.createButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateSaleModel.urlRegex)

  const saleNumber = new URL(await page.url()).pathname.split('/').at(-1)

  await expect(updateSaleModel.pageTitle().locator).toHaveText(`Update Sale ${saleNumber}`)
  await expect(updateSaleModel.form().transactionDescriptionInput().locator).toHaveValue(
    'שולם בהעברה בנקאית',
  )

  // Connect the sale
  await updateSaleModel.form().connectButton().locator.click()

  // Verify sale is now connected and in view mode
  await expect(updateSaleModel.pageTitle().locator).toHaveText(`Sale ${saleNumber}`)
  await expect(updateSaleModel.saleStatus().locator).toHaveText(
    'Regular Sale | Connected to External Providers',
  )

  // Verify the description is still visible in view mode
  await expect(updateSaleModel.form().transactionDescriptionInput().locator).toHaveValue(
    'שולם בהעברה בנקאית',
  )
  await expect(updateSaleModel.form().transactionDescriptionInput().locator).toBeVisible()

  // Verify the transaction description was passed to Cardcom
  const taxInvoiceDocument = await cardcomIntegration()._test_getTaxInvoiceDocument('1')
  expect(taxInvoiceDocument).toBeDefined()
  expect(taxInvoiceDocument?.transactionDescription).toBe('שולם בהעברה בנקאית')
})
