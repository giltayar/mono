import Chance from 'chance'
import {fetchAsBufferWithJsonBody} from '@giltayar/http-commons'
import {addQueryParamsToUrl} from '@giltayar/url-commons'
import type {
  CardcomDetailRecurringJson,
  CardcomMasterRecurringJson,
  CardcomSaleWebhookJson,
} from '../src/types.ts'
import type {TaxInvoiceInformation} from '../src/cardcom-integration.ts'
import type {DeliveryInformation} from './cardcom-integration-testkit.ts'

const chance = new Chance()

export async function simulateCardcomSale(
  salesEventNumber: number,
  invoiceInformation: TaxInvoiceInformation,
  delivery: DeliveryInformation | undefined,
  invoiceNumber: string,
  standingOrderNumber: string | undefined,
  serverInfo: {
    secret: string
    baseUrl: string
  },
): Promise<void> {
  const webhookData = generateCardcomWebhookData(
    invoiceInformation,
    delivery,
    invoiceNumber,
    standingOrderNumber,
  )

  const url = addQueryParamsToUrl(new URL('/api/sales/cardcom/sale', serverInfo.baseUrl), {
    secret: serverInfo.secret ?? 'secret',
    'sales-event': salesEventNumber.toString(),
  })

  await fetchAsBufferWithJsonBody(url, webhookData as any)
}

export async function simulateMasterRecurring(
  invoiceInformation: TaxInvoiceInformation,
  standingOrderNumber: string,
  serverInfo: {
    secret: string
    baseUrl: string
  },
): Promise<void> {
  const webhookData = generateMasterRecurringWebhookData(invoiceInformation, standingOrderNumber)

  const url = addQueryParamsToUrl(
    new URL('/api/sales/cardcom/recurring-payment', serverInfo.baseUrl),
    {
      secret: serverInfo.secret ?? 'secret',
    },
  )

  await fetchAsBufferWithJsonBody(url, webhookData as any)
}

export async function simulateDetailRecurring(
  invoiceInformation: TaxInvoiceInformation,
  recurringOrderId: string,
  cardcomInvoiceDocumentNumber: number,
  serverInfo: {
    secret: string
    baseUrl: string
  },
): Promise<void> {
  const webhookData = generateDetailRecurringWebhookData(
    invoiceInformation,
    recurringOrderId,
    cardcomInvoiceDocumentNumber,
  )

  const url = addQueryParamsToUrl(
    new URL('/api/sales/cardcom/recurring-payment', serverInfo.baseUrl),
    {
      secret: serverInfo.secret ?? 'secret',
    },
  )

  await fetchAsBufferWithJsonBody(url, webhookData as any)
}

function generateCardcomWebhookData(
  invoiceInfo: TaxInvoiceInformation,
  delivery: DeliveryInformation | undefined,
  invoiceNumber: string,
  standingOrderNumber: string | undefined,
): CardcomSaleWebhookJson {
  const now = new Date()
  const dealDate = now.toISOString().split('T')[0].replace(/-/g, '/')
  const dealTime = now.toTimeString().split(' ')[0]

  const webhookData: CardcomSaleWebhookJson = {
    ApprovelNumber: chance.integer({min: 1000000, max: 9999999}).toString(),
    CardOwnerName: invoiceInfo.customerName,
    CardOwnerPhone: invoiceInfo.customerPhone,
    CouponNumber: chance.bool()
      ? chance.string({length: 8, alpha: true, numeric: true})
      : undefined,
    DealDate: dealDate,
    DealTime: dealTime,
    internaldealnumber: chance.integer({min: 10000000, max: 99999999}).toString(),
    invoicenumber: invoiceNumber,
    terminalnumber: chance.integer({min: 1000, max: 9999}).toString(),
    responsecode: '0',
    UserEmail: invoiceInfo.customerEmail,
    RecurringAccountID: invoiceInfo.cardcomCustomerId
      ? invoiceInfo.cardcomCustomerId.toString()
      : undefined,
    suminfull: (invoiceInfo.transactionRevenueInCents / 100).toFixed(2),
    ProdTotalLines: (invoiceInfo.productsSold.length - 1).toString(),

    ProductID: invoiceInfo.productsSold[0].productId.toString(),
    ProdQuantity: invoiceInfo.productsSold[0].quantity.toString(),
    ProdPrice: (invoiceInfo.productsSold[0].unitPriceInCents / 100).toFixed(2),

    DeliveryCity: delivery?.city,
    DeliveryStreet: delivery?.street,
    DeliveryBuilding: delivery?.building,
    DeliveryApartment: delivery?.apartment,
    DeliveryFloor: delivery?.floor,
    DeliveryEntrance: delivery?.entrance,
    DeliveryNotes: delivery?.notes,

    RecurringOrderID: standingOrderNumber,
  }

  for (let i = 1; i < invoiceInfo.productsSold.length; i++) {
    const product = invoiceInfo.productsSold[i]
    ;(webhookData as any)[`ProductID${i}`] = product.productId.toString()
    ;(webhookData as any)[`ProdQuantity${i}`] = product.quantity.toString()
    ;(webhookData as any)[`ProdPrice${i}`] = (product.unitPriceInCents / 100).toFixed(2)
  }

  return webhookData
}

function generateMasterRecurringWebhookData(
  invoiceInfo: TaxInvoiceInformation,
  standingOrderNumber: string,
): CardcomMasterRecurringJson {
  return {
    RecordType: 'MasterRecurring',
    AccountId: invoiceInfo.cardcomCustomerId,
    RecurringId: parseInt(standingOrderNumber),
    'FlexItem.Price': invoiceInfo.transactionRevenueInCents / 100,
  }
}

function generateDetailRecurringWebhookData(
  invoiceInfo: TaxInvoiceInformation,
  recurringOrderId: string,
  invoiceDocumentNumber: number,
): CardcomDetailRecurringJson {
  return {
    RecordType: 'DetailRecurring',
    AccountId: invoiceInfo.cardcomCustomerId,
    RecurringId: parseInt(recurringOrderId),
    Status: 'SUCCESSFUL',
    DocumentNumber: invoiceDocumentNumber,
    InternalDealNumber: chance.integer({min: 10000000, max: 99999999}).toString(),
    BillingAttempts: 1,
    Sum: invoiceInfo.transactionRevenueInCents / 100,
  }
}
