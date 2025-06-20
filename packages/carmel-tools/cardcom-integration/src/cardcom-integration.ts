import {throw_} from '@giltayar/functional-commons'
import {$} from 'execa'

export const CARDCOM_API_KEY =
  process.env.CARDCOM_API_KEY ?? throw_(new Error('CARDCOM_API_KEY env variable must be defined'))
export const CARDCOM_API_KEY_PASSWORD =
  process.env.CARDCOM_API_KEY_PASSWORD ??
  throw_(new Error('CARDCOM_API_KEY_PASSWORD env variable must be defined'))
export const CARDCOM_TERMINAL_NUMBER = '150067'
export const CARDCOM_ADD_OR_UPDATE_RECURRING_PAYMENT_URL =
  'https://secure.cardcom.solutions/Interface/RecurringPayment.aspx'
export const CARDCOM_GET_RECURRING_PAYMENT_HISTORY_URL =
  'https://secure.cardcom.solutions/api/v11/RecuringPayments/GetRecurringPaymentHistory'

export async function enableDisableRecurringPayment(
  cardcomRecurringPaymentId: string,
  action: 'enable' | 'disable',
): Promise<Record<string, string>> {
  const url = new URL(CARDCOM_ADD_OR_UPDATE_RECURRING_PAYMENT_URL)

  const bodyParams = new URL('https://dummy-url.example.com').searchParams
  bodyParams.append('terminalnumber', CARDCOM_TERMINAL_NUMBER)
  bodyParams.append('username', CARDCOM_API_KEY)
  bodyParams.append('codepage', '65001') // unicode
  bodyParams.append('Operation', 'update')
  bodyParams.append('RecurringPayments.RecurringId', cardcomRecurringPaymentId)
  bodyParams.append('RecurringPayments.IsActive', action === 'enable' ? 'true' : 'false')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}, ${await response.text()}`)
  }

  const result = await response.text()
  const resultParams = new URL(`https://dummy.example.code?${result}`).searchParams

  if (resultParams.get('ResponseCode') === '0') {
    return Object.fromEntries(resultParams.entries())
  } else {
    throw new Error(`Failed to disable recurring payment: ${result}`)
  }
}

interface RecurringPaymentInfo {
  recurringPaymentId: string
}

export async function fetchRecurringPaymentInformation(
  accountId: string,
): Promise<RecurringPaymentInfo | undefined> {
  const url = new URL(
    'https://secure.cardcom.solutions/api/v11/RecuringPayments/GetRecurringPayment',
  )

  const {stdout} = await $`curl -s ${
    url.href
  } -H ${'Content-Type: application/json'} --request GET --data ${JSON.stringify({
    apiUserName: CARDCOM_API_KEY,
    apiPassword: CARDCOM_API_KEY_PASSWORD,
    accountId,
  })}`

  const result = JSON.parse(stdout)

  interface UpdateItem {
    InternalDecription: string
    RecurringId: string
    [key: string]: any
  }

  const moadonHakodRecurringPayment = result.UpdateList?.find((u: UpdateItem) =>
    u.InternalDecription.includes('הקוד הקוונטי'),
  )

  if (!moadonHakodRecurringPayment) {
    return undefined
  }

  return {
    recurringPaymentId: moadonHakodRecurringPayment.RecurringId,
  }
}

interface BadPayment {
  date: Date
  badPaymentCount: number
}

export async function fetchRecurringPaymentBadPayments(
  accountId: string,
  productId: string,
): Promise<BadPayment[] | undefined> {
  const url = new URL(
    'https://secure.cardcom.solutions/api/v11/RecuringPayments/GetRecurringPaymentHistory',
  )

  const {stdout} = await $`curl -s ${
    url.href
  } -H ${'Content-Type: application/json'} --request GET --data ${JSON.stringify({
    apiUserName: CARDCOM_API_KEY,
    apiPassword: CARDCOM_API_KEY_PASSWORD,
    accountId,
    FromDate: '01012020',
    ToDate: '01012040',
  })}`

  const result = JSON.parse(stdout)

  interface RecurringPaymentHistoryItem {
    ProductID: string
    CreateDate: string
    Status: string
    BillingAttempts: number
    [key: string]: any
  }

  const moadonHakodRecurringPayment = result.RecurringPaymentHistory?.filter(
    (u: RecurringPaymentHistoryItem) => u.ProductID === productId,
  )

  if (!moadonHakodRecurringPayment || moadonHakodRecurringPayment.length === 0) {
    return undefined
  }

  return moadonHakodRecurringPayment
    .map((u: RecurringPaymentHistoryItem) => ({
      date: new Date(u.CreateDate),
      badPaymentCount: u.Status === 'SUCCESSFUL' ? 0 : u.BillingAttempts,
    }))
    .sort((a: BadPayment, b: BadPayment) => a.date.getTime() - b.date.getTime())
}
