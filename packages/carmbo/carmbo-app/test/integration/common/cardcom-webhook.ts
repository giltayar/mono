import {addQueryParamsToUrl} from '@giltayar/url-commons'

export function cardcomWebhookUrl(salesEventNumber: number, baseUrl: URL, secret: string): URL {
  return addQueryParamsToUrl(new URL('/api/sales/cardcom/sale', baseUrl), {
    secret,
    'sales-event': salesEventNumber.toString(),
  })
}

export function cardcomRecurringPaymentWebhookUrl(baseUrl: URL, secret: string): URL {
  return addQueryParamsToUrl(new URL('/api/sales/cardcom/recurring-payment', baseUrl), {
    secret,
  })
}
