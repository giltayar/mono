import yargs from 'yargs'
import {hideBin} from 'yargs/helpers'
import {simulateCardcomSale} from '../common/cardcom-simulation.ts'

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

console.log('Sending Cardcom webhook simulation to', argv.url, argv.salesEvent.toString())
console.log(
  await simulateCardcomSale({
    salesEventNumber: argv.salesEvent,
    products,
    email: argv.email,
    phone: argv.phone,
    name: argv.name,
    baseUrl: argv.url,
    secret: argv.secret,
  }),
)
