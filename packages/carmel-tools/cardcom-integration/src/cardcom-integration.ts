import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import {fetchAsJsonWithJsonBody} from '@giltayar/http-commons'
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
    refundTransaction: sBind(refundTransaction),
    fetchRecurringPaymentInformation: sBind(fetchRecurringPaymentInformation),
    fetchRecurringPaymentBadPayments: sBind(fetchRecurringPaymentBadPayments),
    fetchAccountInformation: sBind(fetchAccountInformation),
    createTaxInvoiceDocument: sBind(createTaxInvoiceDocument),
    createTaxInvoiceDocumentUrl: sBind(createTaxInvoiceDocumentUrl),
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
  nameMatch: RegExp,
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
    nameMatch.test(u.InternalDecription),
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
  productIds: string[],
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
    (u: RecurringPaymentHistoryItem) => productIds.includes(u.ProductID),
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

export interface TaxInvoiceInformation {
  customerName: string
  customerEmail: string
  customerPhone: string | undefined
  cardcomCustomerId: number | undefined
  productsSold: {
    productId: string
    productName: string
    quantity: number
    unitPriceInCents: number
  }[]
  transactionRevenueInCents: number
  transactionDate: Date
}

// More information here: https://cardcomapi.zendesk.com/hc/he/articles/25360043043602-%D7%99%D7%A6%D7%99%D7%A8%D7%AA-%D7%97%D7%A9%D7%91%D7%95%D7%A0%D7%99%D7%95%D7%AA-Create-Tax-invoice
// And here:https://secure.cardcom.solutions/Api/v11/Docs#tag/Documents/operation/Documents_CreateTaxInvoice
export async function createTaxInvoiceDocument(
  s: CardcomIntegrationServiceData,
  invoiceInformation: TaxInvoiceInformation,
  options: {
    sendInvoiceByMail: boolean
  },
): Promise<{cardcomInvoiceNumber: number; cardcomDocumentLink: string; cardcomCustomerId: string}> {
  const url = new URL('https://secure.cardcom.solutions/api/v11/Documents/CreateTaxInvoice')

  const result = (await fetchAsJsonWithJsonBody(url, {
    ApiName: s.context.apiKey,
    ApiPassword: s.context.apiKeyPassword,
    InvoiceType: 1, // חשבונית מס קבלה
    InvoiceHead: {
      CustName: invoiceInformation.customerName,
      Email: invoiceInformation.customerEmail,
      SendByEmail: options.sendInvoiceByMail,
      ...(invoiceInformation.customerPhone ? {CustMobilePH: invoiceInformation.customerPhone} : {}),
      ...(invoiceInformation.cardcomCustomerId
        ? {AccountID: invoiceInformation.cardcomCustomerId}
        : {}),
    },
    InvoiceLines: invoiceInformation.productsSold.map((ps) => ({
      ProductID: ps.productId,
      Description: ps.productName,
      Quantity: ps.quantity,
      Price: ps.unitPriceInCents / 100,
    })),
    CustomLines: [
      {
        TranDate: invoiceInformation.transactionDate.toISOString(),
        Sum: invoiceInformation.transactionRevenueInCents / 100,
      },
    ],
  })) as {
    ResponseCode: number
    InvoiceNumber: number
    InvoiceLink: string
    AccountID: string
    Description: string
  }

  if (result.ResponseCode !== 0) {
    throw new Error(
      `Failed to create tax invoice document: ${result.ResponseCode}: ${result.Description}`,
    )
  }

  return {
    cardcomInvoiceNumber: result.InvoiceNumber,
    cardcomDocumentLink: result.InvoiceLink,
    cardcomCustomerId: result.AccountID,
  }
}

export async function createTaxInvoiceDocumentUrl(
  s: CardcomIntegrationServiceData,
  cardcomInvoiceNumber: string,
) {
  const url = new URL('https://secure.cardcom.solutions/api/v11/Documents/CreateDocumentUrl')

  const result = (await fetchAsJsonWithJsonBody(url, {
    ApiName: s.context.apiKey,
    ApiPassword: s.context.apiKeyPassword,
    DocumentType: 'TaxInvoiceAndReceipt',
    DocumentNumber: cardcomInvoiceNumber,
  })) as {DocUrl: string}

  return {url: result.DocUrl}
}

export interface AccountInformation {
  accountId: string
  name: string
  email: string | undefined
  phone: string | undefined
}

async function fetchAccountInformation(
  service: CardcomIntegrationServiceData,
  accountId: number,
): Promise<AccountInformation> {
  const url = new URL('https://secure.cardcom.solutions/api/v11/Account/GetByAccountId')

  const response = (await fetchAsJsonWithJsonBody(url, {
    ApiName: service.context.apiKey,
    ApiPassword: service.context.apiKeyPassword,
    AccountId: accountId,
  })) as {
    AccountId: string
    Name: string
    Email?: string
    Phone?: string
    Mobile?: string
  }

  return {
    accountId: response.AccountId,
    name: response.Name,
    email: response.Email,
    phone: response.Mobile || response.Phone,
  }
}

async function refundTransaction(
  service: CardcomIntegrationServiceData,
  transactionId: string,
): Promise<{refundTransactionId: string}> {
  const url = new URL('https://secure.cardcom.solutions/api/v11/Transactions/RefundByTransactionId')

  const response = (await fetchAsJsonWithJsonBody(url, {
    ApiName: service.context.apiKey,
    ApiPassword: service.context.apiKeyPassword,
    TransactionId: transactionId,
  })) as {
    ResponseCode: number
    Description: string
    NewTranzactionId: string
  }

  if (response.ResponseCode !== 0) {
    throw new Error(
      `Failed to refund transaction ${transactionId}: ${response.ResponseCode}: ${response.Description}`,
    )
  }

  return {refundTransactionId: response.NewTranzactionId}
}
