import Chance from 'chance'
import {fetchAsBufferWithJsonBody} from '@giltayar/http-commons'
import {addQueryParamsToUrl} from '@giltayar/url-commons'
import type {CardcomSaleWebhookJson} from '../src/types.ts'
import type {TaxInvoiceInformation} from '../src/cardcom-integration.ts'

const chance = new Chance()

export async function simulateCardcomSale(
  salesEventNumber: number,
  invoiceInformation: TaxInvoiceInformation,
  invoiceNumber: string,
  serverInfo: {
    secret: string
    baseUrl: string
  },
): Promise<void> {
  const webhookData = generateCardcomWebhookData(invoiceInformation, invoiceNumber)

  const url = addQueryParamsToUrl(new URL('/api/sales/cardcom/one-time-sale', serverInfo.baseUrl), {
    secret: serverInfo.secret ?? 'secret',
    'sales-event': salesEventNumber.toString(),
  })

  await fetchAsBufferWithJsonBody(url.toString(), webhookData as any)
}

function generateCardcomWebhookData(
  invoiceInfo: TaxInvoiceInformation,
  invoiceNumber: string,
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
  }

  for (let i = 1; i < invoiceInfo.productsSold.length; i++) {
    const product = invoiceInfo.productsSold[i]
    ;(webhookData as any)[`ProductID${i}`] = product.productId.toString()
    ;(webhookData as any)[`ProdQuantity${i}`] = product.quantity.toString()
    ;(webhookData as any)[`ProdPrice${i}`] = (product.unitPriceInCents / 100).toFixed(2)
  }

  return webhookData
}
