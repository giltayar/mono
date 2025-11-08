import type {TaxInvoiceInformation} from '@giltayar/carmel-tools-cardcom-integration/service'
import {createFakeCardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/testkit'
import yargs from 'yargs'
import {hideBin} from 'yargs/helpers'

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
  .option('name', {
    type: 'string',
    description: 'Customer name',
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
  .option('recurring', {
    type: 'boolean',
    description: 'Simulate a recurring payment',
    default: false,
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
    productId,
    productName: 'Product ' + productId,
    quantity: parseInt(quantity),
    unitPriceInCents: parseFloat(price) * 100,
  }
})

const cardcomIntegration = createFakeCardcomIntegrationService({accounts: {}})

console.log('Sending Cardcom webhook simulation to', argv.url, argv.salesEvent.toString())
if (argv.recurring) {
  console.log(
    await cardcomIntegration._test_simulateCardcomStandingOrder(
      argv.salesEvent,
      {
        cardcomCustomerId: undefined,
        customerName: argv.name,
        customerPhone: argv.phone,
        customerEmail: argv.email,
        productsSold: products,
        transactionDate: new Date(),
        transactionRevenueInCents:
          100 * products.reduce((sum, p) => sum + p.unitPriceInCents * p.quantity, 0),
      } as TaxInvoiceInformation,
      undefined,
      {secret: argv.secret, baseUrl: argv.url},
      {cardcomInvoiceNumberToSend: (Math.random() * 1_000_000) | 0},
    ),
  )
} else {
  console.log(
    await cardcomIntegration._test_simulateCardcomSale(
      argv.salesEvent,
      {
        cardcomCustomerId: undefined,
        customerName: argv.name,
        customerPhone: argv.phone,
        customerEmail: argv.email,
        productsSold: products,
        transactionDate: new Date(),
        transactionRevenueInCents: 4,
      } as TaxInvoiceInformation,
      undefined,
      {secret: argv.secret, baseUrl: argv.url},
      {cardcomInvoiceNumberToSend: (Math.random() * 1_000_000) | 0},
    ),
  )
}
