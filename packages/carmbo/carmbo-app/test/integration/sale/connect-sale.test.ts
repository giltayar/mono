import {test, expect} from '@playwright/test'
import {createNewSalePageModel} from '../../page-model/sales/new-sale-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import type {TaxInvoiceInformation} from '@giltayar/carmel-tools-cardcom-integration/service'
import {createUpdateStudentPageModel} from '../../page-model/students/update-student-page.model.ts'
import {humanIsraeliPhoneNumberToWhatsAppId} from '@giltayar/carmel-tools-whatsapp-integration/utils'

const {url, sql, smooveIntegration, academyIntegration, cardcomIntegration, whatsappIntegration} =
  setup(import.meta.url)

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
      personalMessageWhenJoining: 'Welcome to Product One!',
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
      personalMessageWhenJoining: 'Welcome to Product Two!',
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
      personalMessageWhenJoining: 'Welcome to Product Three!',
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
  await expect(updateSaleModel.form().updateButton().locator).toBeVisible()
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

  const taxInvoiceDocument = await cardcomIntegration().fetchInvoiceInformation(1)

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

  // Verify personal messages were sent for products with quantity > 0
  const contactId = humanIsraeliPhoneNumberToWhatsAppId('1234567890')
  const sentMessages = whatsappIntegration()._test_sentContactMessages(contactId)
  expect(sentMessages).toContain('Welcome to Product One!')
  expect(sentMessages).toContain('Welcome to Product Two!')
  expect(sentMessages).not.toContain('Welcome to Product Three!')

  await page.goto(new URL(`/students/${studentNumber}`, url()).href)

  await expect(updateStudentModel.pageTitle().locator).toHaveText(`Update Student ${studentNumber}`)

  const studentForm = updateStudentModel.form()
  await expect(studentForm.cardcomCustomerIdsInput().locator).toHaveValue(
    taxInvoiceDocument?.cardcomCustomerId?.toString() ?? '',
  )

  // Verify notes can be updated on a connected manual sale
  await page.goto(new URL(`/sales/${saleNumber}`, url()).href)
  await page.waitForURL(updateSaleModel.urlRegex)

  await updateSaleModel.form().notesInput().locator.fill('Notes on a connected sale')
  await updateSaleModel.form().updateButton().locator.click()

  await page.waitForURL(updateSaleModel.urlRegex)
  await expect(updateSaleModel.form().notesInput().locator).toHaveValue('Notes on a connected sale')
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
      personalMessageWhenJoining: 'Welcome to Product One!',
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
      personalMessageWhenJoining: 'Welcome to Product Two!',
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
  await expect(updateSaleModel.form().updateButton().locator).toBeVisible()
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

  const taxInvoiceDocument =
    await cardcomIntegration().fetchInvoiceInformation(cardcomInvoiceNumber)

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

  // Verify personal messages were sent
  await expect(async () => {
    const contactId2 = humanIsraeliPhoneNumberToWhatsAppId('1234567890')
    const sentMessages2 = whatsappIntegration()._test_sentContactMessages(contactId2)
    expect(sentMessages2).toContain('Welcome to Product One!')
    expect(sentMessages2).toContain('Welcome to Product Two!')
  }).toPass()

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
      personalMessageWhenJoining: 'Welcome to Product One!',
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
      personalMessageWhenJoining: 'Welcome to Product Two!',
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
  await expect(updateSaleModel.form().updateButton().locator).toBeVisible()
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

  const taxInvoiceDocument = await cardcomIntegration().fetchInvoiceInformation(1)

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

  // Verify personal messages were sent on both connect and reconnect
  await expect(async () => {
    const contactId3 = humanIsraeliPhoneNumberToWhatsAppId('1234567890')
    const sentMessages3 = whatsappIntegration()._test_sentContactMessages(contactId3)
    expect(sentMessages3.filter((m) => m === 'Welcome to Product One!').length).toBe(2)
    expect(sentMessages3.filter((m) => m === 'Welcome to Product Two!').length).toBe(2)
  }).toPass()

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
      personalMessageWhenJoining: 'Welcome to Test Product!',
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
  const taxInvoiceDocument = await cardcomIntegration().fetchInvoiceInformation(1)
  expect(taxInvoiceDocument).toBeDefined()
  expect(taxInvoiceDocument?.transactionDescription).toBe('שולם בהעברה בנקאית')

  // Verify personal message was sent
  await expect(async () => {
    const contactId4 = humanIsraeliPhoneNumberToWhatsAppId('0501234567')
    const sentMessages4 = whatsappIntegration()._test_sentContactMessages(contactId4)
    expect(sentMessages4).toContain('Welcome to Test Product!')
  }).toPass()
})
