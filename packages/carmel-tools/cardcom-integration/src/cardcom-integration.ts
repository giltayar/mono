import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import {$} from 'execa'
import type {
  RecurringPaymentInfo,
  BadPayment,
} from '@giltayar/carmel-tools-cardcom-integration/types'

export interface CardcomIntegrationServiceContext {
  apiKey: string
  apiKeyPassword: string
  terminalNumber: string
}

type CardcomIntegrationServiceData = {
  context: CardcomIntegrationServiceContext
}

export function createCardcomIntegrationService(context: CardcomIntegrationServiceContext) {
  const sBind: ServiceBind<CardcomIntegrationServiceData> = (f) => bind(f, {context})

  return {
    enableDisableRecurringPayment: sBind(enableDisableRecurringPayment),
    fetchRecurringPaymentInformation: sBind(fetchRecurringPaymentInformation),
    fetchRecurringPaymentBadPayments: sBind(fetchRecurringPaymentBadPayments),
  }
}

export type CardcomIntegrationService = ReturnType<typeof createCardcomIntegrationService>

export async function enableDisableRecurringPayment(
  s: CardcomIntegrationServiceData,
  cardcomRecurringPaymentId: string,
  action: 'enable' | 'disable',
): Promise<Record<string, string>> {
  const url = new URL('https://secure.cardcom.solutions/Interface/RecurringPayment.aspx')

  const bodyParams = new URL('https://dummy-url.example.com').searchParams
  bodyParams.append('terminalnumber', s.context.terminalNumber)
  bodyParams.append('username', s.context.apiKey)
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

export async function fetchRecurringPaymentInformation(
  s: CardcomIntegrationServiceData,
  accountId: string,
): Promise<RecurringPaymentInfo | undefined> {
  const url = new URL(
    'https://secure.cardcom.solutions/api/v11/RecuringPayments/GetRecurringPayment',
  )

  const {stdout} = await $`curl -s ${
    url.href
  } -H ${'Content-Type: application/json'} --request GET --data ${JSON.stringify({
    apiUserName: s.context.apiKey,
    apiPassword: s.context.apiKeyPassword,
    accountId,
  })}`

  const result = JSON.parse(stdout)

  interface UpdateItem {
    InternalDecription: string
    RecurringId: string
    [key: string]: unknown
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

export async function fetchRecurringPaymentBadPayments(
  s: CardcomIntegrationServiceData,
  accountId: string,
  productId: string,
): Promise<BadPayment[] | undefined> {
  const url = new URL(
    'https://secure.cardcom.solutions/api/v11/RecuringPayments/GetRecurringPaymentHistory',
  )

  const {stdout} = await $`curl -s ${
    url.href
  } -H ${'Content-Type: application/json'} --request GET --data ${JSON.stringify({
    apiUserName: s.context.apiKey,
    apiPassword: s.context.apiKeyPassword,
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
    [key: string]: unknown
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
