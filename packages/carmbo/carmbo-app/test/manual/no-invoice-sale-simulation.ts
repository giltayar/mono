import {fetchAsText} from '@giltayar/http-commons'
import {addQueryParamsToUrl} from '@giltayar/url-commons'
import yargs from 'yargs'
import {hideBin} from 'yargs/helpers'

const argv = await yargs(hideBin(process.argv))
  .option('sales-event', {
    alias: 's',
    type: 'number',
    description: 'Sales event number',
    demandOption: true,
  })
  .option('email', {
    alias: 'e',
    type: 'string',
    description: 'Customer email',
    demandOption: true,
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
    default: 'http://localhost:3000',
  })
  .example('$0 --sales-event 1 --email test@example.com', 'Simulate a sale with 2 products')
  .help()
  .alias('help', 'h')
  .parse()

console.log('Sending no invoice webhook simulation to', argv.url, argv.salesEvent.toString())

const result = await fetchAsText(
  addQueryParamsToUrl(new URL('/api/sales/no-invoice-sale', argv.url), {
    secret: argv.secret,
    'sales-event': argv['sales-event'].toString(),
    email: argv.email,
    phone: argv.phone,
    name: argv.name,
  }),
)

console.log('result', result)
