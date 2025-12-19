import {test, expect} from '@playwright/test'
import {createNewSalePageModel} from '../../page-model/sales/new-sale-page.model.ts'
import {createUpdateSalePageModel} from '../../page-model/sales/update-sale-page.model.ts'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {cardcomWebhookUrl} from './common/cardcom-webhook.ts'

const {url, sql, smooveIntegration, cardcomIntegration} = setup(import.meta.url)

test('create sale with delivery address then update it', async ({page}) => {
  // Setup: Create a student, sales event, and products
  const studentNumber = await createStudent(
    {
      names: [{firstName: 'John', lastName: 'Doe'}],
      emails: ['john.doe@example.com'],
      phones: [],
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
    },
    undefined,
    new Date(),
    sql(),
  )

  const product2Number = await createProduct(
    {
      name: 'Product Two',
      productType: 'challenge',
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

  await page.goto(new URL('/sales/new', url()).href)
  await page.waitForURL(newSaleModel.urlRegex)

  // Fill the new sale form
  const newForm = newSaleModel.form()
  await newForm.salesEventInput().locator.fill(`${salesEventNumber}`)
  await newForm.salesEventInput().locator.blur()
  await newForm.studentInput().locator.fill(`${studentNumber}`)
  await newForm.studentInput().locator.blur()

  await expect(newForm.deliveryAddress().locator).toBeHidden()

  await newForm.hasDeliveryAddressCheckbox().locator.click()

  await newForm.deliveryAddress().streetInput().locator.fill('Main St')
  await newForm.deliveryAddress().streetNumberInput().locator.fill('123')
  await newForm.deliveryAddress().cityInput().locator.fill('Metropolis')
  await newForm.deliveryAddress().floorInput().locator.fill('5')
  await newForm.deliveryAddress().apartmentNumberInput().locator.fill('12B')
  await newForm.deliveryAddress().entranceInput().locator.fill('East Wing')
  await newForm.deliveryAddress().contactPhoneInput().locator.fill('123-456-7890')
  await newForm.deliveryAddress().notesInput().locator.fill('Leave at the front desk.')

  await newForm.hasDeliveryAddressCheckbox().locator.click()

  await expect(newForm.deliveryAddress().locator).toBeHidden()

  await newForm.hasDeliveryAddressCheckbox().locator.click()

  await expect(newForm.deliveryAddress().streetInput().locator).toHaveValue('Main St')
  await expect(newForm.deliveryAddress().streetNumberInput().locator).toHaveValue('123')
  await expect(newForm.deliveryAddress().cityInput().locator).toHaveValue('Metropolis')
  await expect(newForm.deliveryAddress().floorInput().locator).toHaveValue('5')
  await expect(newForm.deliveryAddress().apartmentNumberInput().locator).toHaveValue('12B')
  await expect(newForm.deliveryAddress().entranceInput().locator).toHaveValue('East Wing')
  await expect(newForm.deliveryAddress().contactPhoneInput().locator).toHaveValue('123-456-7890')
  await expect(newForm.deliveryAddress().notesInput().locator).toHaveValue(
    'Leave at the front desk.',
  )

  await newForm.finalSaleRevenueInput().locator.fill('200')

  // Save the sale
  await newForm.createButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateSaleModel.urlRegex)

  const updateForm = updateSaleModel.form()

  await expect(updateForm.hasDeliveryAddressCheckbox().locator).toBeChecked()

  await expect(updateForm.deliveryAddress().streetInput().locator).toHaveValue('Main St')
  await expect(updateForm.deliveryAddress().streetNumberInput().locator).toHaveValue('123')
  await expect(updateForm.deliveryAddress().cityInput().locator).toHaveValue('Metropolis')
  await expect(updateForm.deliveryAddress().floorInput().locator).toHaveValue('5')
  await expect(updateForm.deliveryAddress().apartmentNumberInput().locator).toHaveValue('12B')
  await expect(updateForm.deliveryAddress().entranceInput().locator).toHaveValue('East Wing')
  await expect(updateForm.deliveryAddress().contactPhoneInput().locator).toHaveValue('123-456-7890')
  await expect(updateForm.deliveryAddress().notesInput().locator).toHaveValue(
    'Leave at the front desk.',
  )

  await updateForm.deliveryAddress().streetInput().locator.fill('zMain St')
  await updateForm.deliveryAddress().streetNumberInput().locator.fill('z123')
  await updateForm.deliveryAddress().cityInput().locator.fill('zMetropolis')
  await updateForm.deliveryAddress().floorInput().locator.fill('z5')
  await updateForm.deliveryAddress().apartmentNumberInput().locator.fill('z12B')
  await updateForm.deliveryAddress().entranceInput().locator.fill('zEast Wing')
  await updateForm.deliveryAddress().contactPhoneInput().locator.fill('z123-456-7890')
  await updateForm.deliveryAddress().notesInput().locator.fill('zLeave at the front desk.')

  await updateForm.updateButton().locator.click()

  await expect(updateSaleModel.history().items().locator).toHaveCount(2)

  await expect(updateForm.deliveryAddress().streetInput().locator).toHaveValue('zMain St')
  await expect(updateForm.deliveryAddress().streetNumberInput().locator).toHaveValue('z123')
  await expect(updateForm.deliveryAddress().cityInput().locator).toHaveValue('zMetropolis')
  await expect(updateForm.deliveryAddress().floorInput().locator).toHaveValue('z5')
  await expect(updateForm.deliveryAddress().apartmentNumberInput().locator).toHaveValue('z12B')
  await expect(updateForm.deliveryAddress().entranceInput().locator).toHaveValue('zEast Wing')
  await expect(updateForm.deliveryAddress().contactPhoneInput().locator).toHaveValue(
    'z123-456-7890',
  )
  await expect(updateForm.deliveryAddress().notesInput().locator).toHaveValue(
    'zLeave at the front desk.',
  )
})

test('cardcom sale with delivery creates delivery address in sale', async ({page}) => {
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
      transactionRevenueInCents: 21 * 100,
    },
    {
      apartment: '12B',
      building: '123',
      city: 'Metropolis',
      entrance: 'East Wing',
      floor: '5',
      street: 'Main St',
      notes: 'Leave at the front desk.',
    },
    cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
  )

  await page.goto(new URL('/sales/1', url()).href)

  const saleDetailModel = createUpdateSalePageModel(page)

  await expect(saleDetailModel.form().hasDeliveryAddressCheckbox().locator).toBeChecked()

  await expect(saleDetailModel.form().hasDeliveryAddressCheckbox().locator).toHaveAttribute(
    'readonly',
  )

  const deliveryAddress = saleDetailModel.form().deliveryAddress()

  await expect(deliveryAddress.streetInput().locator).toHaveValue('Main St')
  await expect(deliveryAddress.streetNumberInput().locator).toHaveValue('123')
  await expect(deliveryAddress.cityInput().locator).toHaveValue('Metropolis')
  await expect(deliveryAddress.floorInput().locator).toHaveValue('5')
  await expect(deliveryAddress.apartmentNumberInput().locator).toHaveValue('12B')
  await expect(deliveryAddress.entranceInput().locator).toHaveValue('East Wing')
  await expect(deliveryAddress.contactPhoneInput().locator).toHaveValue('0501234567')
  await expect(deliveryAddress.notesInput().locator).toHaveValue('Leave at the front desk.')

  await expect(deliveryAddress.streetInput().locator).toHaveAttribute('readonly')
  await expect(deliveryAddress.streetNumberInput().locator).toHaveAttribute('readonly')
  await expect(deliveryAddress.cityInput().locator).toHaveAttribute('readonly')
  await expect(deliveryAddress.floorInput().locator).toHaveAttribute('readonly')
  await expect(deliveryAddress.apartmentNumberInput().locator).toHaveAttribute('readonly')
  await expect(deliveryAddress.entranceInput().locator).toHaveAttribute('readonly')
  await expect(deliveryAddress.contactPhoneInput().locator).toHaveAttribute('readonly')
  await expect(deliveryAddress.notesInput().locator).toHaveAttribute('readonly')
})
