import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createSalesEvent} from '../../../src/domain/sales-event/model/model.ts'
import {createSaleProvidersPageModel} from '../../page-model/sales/sale-providers-page.model.ts'
import {cardcomWebhookUrl} from './common/cardcom-webhook.ts'

const {url, sql, smooveIntegration, ravmesserIntegration, cardcomIntegration} = setup(
  import.meta.url,
  {withRavmesserIntegration: true},
)

const smooveListId = 2
const ravmesserListId = 102
const ravmesserRemovedListId = 106

test('a sale with both a smoove and a ravmesser product subscribes each in its own provider', async ({
  page,
}) => {
  const smooveProductNumber = await createProduct(
    {
      name: 'Smoove Product',
      productType: 'recorded',
      mailingListProvider: 'smoove',
      smooveListId,
      smooveRemovedListId: 8,
    },
    undefined,
    new Date(),
    sql(),
  )

  const ravmesserProductNumber = await createProduct(
    {
      name: 'Ravmesser Product',
      productType: 'recorded',
      mailingListProvider: 'ravmesser',
      ravmesserListId,
      ravmesserRemovedListId,
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
      productsForSale: [smooveProductNumber, ravmesserProductNumber],
    },
    undefined,
    new Date(),
    sql(),
  )

  const customerEmail = 'ravmesser-customer@example.com'

  await cardcomIntegration()._test_simulateCardcomSale(
    {
      productsSold: [
        {
          productId: smooveProductNumber.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Smoove Product',
        },
        {
          productId: ravmesserProductNumber.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Ravmesser Product',
        },
      ],
      customerEmail,
      customerName: 'Jane Roe',
      customerPhone: '0501234567',
      cardcomCustomerId: 1777,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 200 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
  )

  await expect(async () => {
    const ravmesserContacts = await ravmesserIntegration().fetchContactsOfList(ravmesserListId)
    expect(ravmesserContacts.length).toBe(1)
    expect(ravmesserContacts[0].email).toBe(customerEmail)
    expect(ravmesserContacts[0].firstName).toBe('Jane')
    expect(ravmesserContacts[0].lastName).toBe('Roe')
  }).toPass()

  await expect(async () => {
    const smooveContacts = await smooveIntegration().fetchContactsOfList(smooveListId)
    expect(smooveContacts.length).toBe(1)
    expect(smooveContacts[0].email).toBe(customerEmail)
  }).toPass()

  // The ravmesser product must not have leaked into the smoove list, and vice versa
  expect(await ravmesserIntegration().fetchContactsOfList(smooveListId)).toHaveLength(0)
  expect(await smooveIntegration().fetchContactsOfList(ravmesserListId)).toHaveLength(0)

  await page.goto(new URL('/sales/1/providers', url()).href)

  const providersModel = createSaleProvidersPageModel(page)
  const smooveCard = providersModel.productCards().card(0)
  const ravmesserCard = providersModel.productCards().card(1)

  await expect(smooveCard.smooveLists().mainListCheckbox().locator).toBeChecked()
  await expect(smooveCard.ravmesserLists().locator).toBeHidden()

  await expect(ravmesserCard.ravmesserLists().mainListCheckbox().locator).toBeChecked()
  await expect(ravmesserCard.ravmesserLists().removedListCheckbox().locator).not.toBeChecked()
  await expect(ravmesserCard.smooveLists().locator).toBeHidden()
})

test('disconnecting a sale moves the student to the ravmesser removed list', async ({page}) => {
  const productNumber = await createProduct(
    {
      name: 'Ravmesser Product',
      productType: 'recorded',
      mailingListProvider: 'ravmesser',
      ravmesserListId,
      ravmesserRemovedListId,
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

  const customerEmail = 'ravmesser-disconnect@example.com'

  await cardcomIntegration()._test_simulateCardcomSale(
    {
      productsSold: [
        {
          productId: productNumber.toString(),
          quantity: 1,
          unitPriceInCents: 100 * 100,
          productName: 'Ravmesser Product',
        },
      ],
      customerEmail,
      customerName: 'Jane Roe',
      customerPhone: '0501234567',
      cardcomCustomerId: 1778,
      transactionDate: new Date(),
      transactionDescription: undefined,
      transactionRevenueInCents: 100 * 100,
    },
    undefined,
    cardcomWebhookUrl(salesEventNumber, url(), 'secret'),
  )

  await expect(async () => {
    expect(await ravmesserIntegration().fetchContactsOfList(ravmesserListId)).toHaveLength(1)
  }).toPass()

  await page.goto(new URL('/sales/1/providers', url()).href)

  const providersModel = createSaleProvidersPageModel(page)
  const card = providersModel.productCards().card(0)

  await expect(card.ravmesserLists().mainListCheckbox().locator).toBeChecked()

  await page.goto(new URL('/sales/1', url()).href)
  await page.getByRole('button', {name: 'Disconnect'}).click()

  await expect(async () => {
    expect(await ravmesserIntegration().fetchContactsOfList(ravmesserListId)).toHaveLength(0)
    expect(await ravmesserIntegration().fetchContactsOfList(ravmesserRemovedListId)).toHaveLength(1)
  }).toPass()
})
