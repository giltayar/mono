import yargs from 'yargs'
import {hideBin} from 'yargs/helpers'
import Chance from 'chance'
import type {CardcomSaleWebhookJson} from '../domain/sale/model-cardcom-sale.ts'
import {fetchAsTextWithJsonBody} from '@giltayar/http-commons'
import {addQueryParamsToUrl} from '@giltayar/url-commons'

const chance = new Chance()

const argv = await yargs(hideBin(process.argv))
  .option('sales-event', {
    alias: 's',
    type: 'number',
    description: 'Sales event number',
    demandOption: true,
  })
  .option('product', {
    alias: 'p',
    type: 'array',
    description: 'Product in format: productNumber,quantity,price',
    demandOption: true,
  })
  .option('email', {
    alias: 'e',
    type: 'string',
    description: 'Customer email',
  })
  .option('phone', {
    type: 'string',
    description: 'Customer phone number',
  })
  .option('secret', {
    type: 'string',
    description: 'API secret',
    default: 'secret',
  })
  .option('url', {
    alias: 'u',
    type: 'string',
    description: 'Base URL of the API',
    default: 'http://localhost:4000',
  })
  .example(
    '$0 --sales-event 1 --product "101,2,50" --product "102,1,100" --email test@example.com',
    'Simulate a sale with 2 products',
  )
  .help()
  .alias('help', 'h')
  .parse()

const products = argv.product.map((p) => {
  const [productId, quantity, price] = (p as string).split(',')
  if (!productId || !quantity || !price) {
    throw new Error(`Invalid product format: ${p}. Expected: productNumber,quantity,price`)
  }
  return {
    productId: parseInt(productId),
    quantity: parseInt(quantity),
    price: parseFloat(price),
  }
})

const totalAmount = products.reduce((sum, p) => sum + p.price * p.quantity, 0)

const now = new Date()
const dealDate = now.toISOString().split('T')[0].replace(/-/g, '/') // YYYY/MM/DD
const dealTime = now.toTimeString().split(' ')[0] // HH:MM:SS

const webhookData: CardcomSaleWebhookJson = {
  ApprovelNumber: chance.integer({min: 1000000, max: 9999999}).toString(),
  CardOwnerName: chance.name(),
  CardOwnerPhone: argv.phone ?? chance.phone({formatted: false}),
  CouponNumber: chance.bool() ? chance.string({length: 8, alpha: true, numeric: true}) : undefined,
  DealDate: dealDate,
  DealTime: dealTime,
  internaldealnumber: chance.guid(),
  invoicenumber: chance.integer({min: 100000, max: 999999}).toString(),
  terminalnumber: chance.integer({min: 1000, max: 9999}).toString(),
  responsecode: '0',
  UserEmail: argv.email ?? chance.email(),
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

const url = addQueryParamsToUrl(new URL('/api/sales/cardcom/one-time-sale', argv.url), {
  secret: argv.secret,
  'sales-event': argv.salesEvent.toString(),
})

console.log('Sending Cardcom webhook simulation to', url.toString(), argv.salesEvent.toString())
console.log(await fetchAsTextWithJsonBody(url.toString(), webhookData))
