import Chance from 'chance'
import type {CardcomSaleWebhookJson} from '../../src/domain/sale/model-cardcom-sale.ts'
import {fetchAsTextWithJsonBody} from '@giltayar/http-commons'
import {addQueryParamsToUrl} from '@giltayar/url-commons'

const chance = new Chance()

export interface CardcomSaleProduct {
  productId: number
  quantity: number
  price: number
}

export interface CardcomSaleOptions {
  salesEventNumber: number
  products: CardcomSaleProduct[]
  email?: string
  phone?: string
  name?: string
  customerId?: string
  baseUrl: string
  secret?: string
}

export function generateCardcomWebhookData(
  products: CardcomSaleProduct[],
  options: {
    email?: string
    phone?: string
    name?: string
    customerId?: string
  } = {},
): CardcomSaleWebhookJson {
  const totalAmount = products.reduce((sum, p) => sum + p.price * p.quantity, 0)

  const now = new Date()
  const dealDate = now.toISOString().split('T')[0].replace(/-/g, '/')
  const dealTime = now.toTimeString().split(' ')[0]

  const webhookData: CardcomSaleWebhookJson = {
    ApprovelNumber: chance.integer({min: 1000000, max: 9999999}).toString(),
    CardOwnerName: options.name ?? chance.name(),
    CardOwnerPhone: options.phone ?? chance.phone({formatted: false}),
    CouponNumber: chance.bool()
      ? chance.string({length: 8, alpha: true, numeric: true})
      : undefined,
    DealDate: dealDate,
    DealTime: dealTime,
    internaldealnumber: chance.integer({min: 10000000, max: 99999999}).toString(),
    invoicenumber: chance.integer({min: 100000, max: 999999}).toString(),
    terminalnumber: chance.integer({min: 1000, max: 9999}).toString(),
    responsecode: '0',
    UserEmail: options.email ?? chance.email(),
    RecurringAccountID: options.customerId,
    suminfull: totalAmount.toFixed(2),
    ProdTotalLines: (products.length - 1).toString(),

    ProductID: products[0].productId.toString(),
    ProdQuantity: products[0].quantity.toString(),
    ProdPrice: products[0].price.toFixed(2),
  }

  for (let i = 1; i < products.length; i++) {
    const product = products[i]
    ;(webhookData as any)[`ProductID${i}`] = product.productId.toString()
    ;(webhookData as any)[`ProdQuantity${i}`] = product.quantity.toString()
    ;(webhookData as any)[`ProdPrice${i}`] = product.price.toFixed(2)
  }

  return webhookData
}

export async function simulateCardcomSale(options: CardcomSaleOptions): Promise<string> {
  const webhookData = generateCardcomWebhookData(options.products, {
    email: options.email,
    phone: options.phone,
    name: options.name,
    customerId: options.customerId,
  })

  const url = addQueryParamsToUrl(new URL('/api/sales/cardcom/one-time-sale', options.baseUrl), {
    secret: options.secret ?? 'secret',
    'sales-event': options.salesEventNumber.toString(),
  })

  return await fetchAsTextWithJsonBody(url.toString(), webhookData as any)
}
