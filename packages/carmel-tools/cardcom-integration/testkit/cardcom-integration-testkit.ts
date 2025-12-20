import type {
  CardcomIntegrationService,
  TaxInvoiceInformation,
  AccountInformation,
} from '@giltayar/carmel-tools-cardcom-integration/service'
import type {
  RecurringPaymentInfo,
  BadPayment,
} from '@giltayar/carmel-tools-cardcom-integration/types'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import assert from 'node:assert'
import {
  simulateCardcomSale,
  simulateDetailRecurring,
  simulateMasterRecurring,
} from './cardcom-webhook-simulation.ts'

type CardcomIntegrationServiceData = {
  state: Parameters<typeof createFakeCardcomIntegrationService>[0] & {
    payments: Record<
      string, // transaction id
      {
        invoiceNumber: number
        isRecurring: boolean
        invoiceInformation: TaxInvoiceInformation
        refundTransactionId: string | undefined
      }
    >
  }
}

export interface DeliveryInformation {
  city: string
  street: string
  building: string
  apartment: string | undefined
  floor: string | undefined
  entrance: string | undefined
  notes: string | undefined
}

export interface AccountInfo {
  name: string
  email?: string
  phone?: string
}

export function createFakeCardcomIntegrationService(context: {
  accounts: Record<
    string,
    {
      recurringPayments?: Record<
        string,
        {
          recurringPaymentId: string
          name: string
          isActive: boolean
        }
      >
      badPayments?: Record<string, BadPayment[]>
      accountInfo: AccountInfo
    }
  >
}) {
  const state: CardcomIntegrationServiceData['state'] = {
    accounts: structuredClone(context.accounts),
    payments: {},
  }
  const sBind: ServiceBind<CardcomIntegrationServiceData> = (f) => bind(f, {state})

  const service: CardcomIntegrationService = {
    enableDisableRecurringPayment: sBind(enableDisableRecurringPayment),
    refundTransaction: sBind(refundTransaction),
    fetchRecurringPaymentInformation: sBind(fetchRecurringPaymentInformation),
    fetchRecurringPaymentBadPayments: sBind(fetchRecurringPaymentBadPayments),
    fetchAccountInformation: sBind(fetchAccountInformation),
    createTaxInvoiceDocument: sBind(createTaxInvoiceDocument),
    createTaxInvoiceDocumentUrl: sBind(createTaxInvoiceDocumentUrl),
  }

  return {
    ...service,
    _test_reset_data: () => {
      state.accounts = structuredClone(context.accounts)
      state.payments = {}
    },
    _test_getRecurringPaymentStatus: async (
      accountId: string,
      recurringPaymentId: string,
    ): Promise<boolean | undefined> => {
      const account = state.accounts[accountId]
      if (!account) return undefined

      const recurringPayment = Object.values(account.recurringPayments ?? {}).find(
        (rp) => rp.recurringPaymentId === recurringPaymentId,
      )
      return recurringPayment?.isActive
    },
    _test_getTaxInvoiceDocument: async (
      cardcomInvoiceNumber: string,
    ): Promise<TaxInvoiceInformation | undefined> => {
      return Object.values(state.payments).find(
        (inv) => inv.invoiceNumber === parseInt(cardcomInvoiceNumber, 10),
      )?.invoiceInformation
    },
    _test_simulateCardcomSale: sBind(_test_simulateCardcomSale),
    _test_simulateCardcomStandingOrder: sBind(_test_simulateCardcomStandingOrder),
    _test_simulateCardcomStandingOrderPayment: sBind(_test_simulateCardcomStandingOrderPayment),
    _test_getPaymentInfo: (invoiceNumber: number) => {
      const payment = Object.values(state.payments).find(
        (inv) => inv.invoiceNumber === invoiceNumber,
      )
      if (!payment) {
        throw new Error(`Payment with invoice  ${invoiceNumber} not found`)
      }
      return payment
    },
    _test_isPaymentRefunded: (invoiceNumber: number) => {
      const payment = Object.values(state.payments).find(
        (inv) => inv.invoiceNumber === invoiceNumber,
      )
      if (!payment) {
        throw new Error(`Payment with invoice ${invoiceNumber} not found`)
      }
      return payment.refundTransactionId !== undefined
    },
  }
}

async function enableDisableRecurringPayment(
  s: CardcomIntegrationServiceData,
  cardcomRecurringPaymentId: string,
  action: 'enable' | 'disable',
): Promise<Record<string, string>> {
  for (const account of Object.values(s.state.accounts)) {
    for (const recurringPayment of Object.values(account.recurringPayments ?? {})) {
      if (recurringPayment.recurringPaymentId === cardcomRecurringPaymentId) {
        recurringPayment.isActive = action === 'enable'
        return {
          ResponseCode: '0',
          RecurringId: cardcomRecurringPaymentId,
          IsActive: action === 'enable' ? 'true' : 'false',
        }
      }
    }
  }

  throw new Error(`Recurring payment ${cardcomRecurringPaymentId} not found`)
}

async function fetchRecurringPaymentInformation(
  s: CardcomIntegrationServiceData,
  accountId: string,
  nameMatch: RegExp,
): Promise<RecurringPaymentInfo | undefined> {
  const account = s.state.accounts[accountId]
  if (!account) return undefined

  // Find the first recurring payment that matches the name
  const recurringPayment = Object.values(account.recurringPayments ?? {}).find((rp) =>
    nameMatch.test(rp.name),
  )
  if (!recurringPayment) return undefined

  return {
    recurringPaymentId: recurringPayment.recurringPaymentId,
  }
}

async function fetchRecurringPaymentBadPayments(
  s: CardcomIntegrationServiceData,
  accountId: string,
  productIds: string[],
): Promise<BadPayment[] | undefined> {
  const account = s.state.accounts[accountId]
  if (!account) return undefined

  const badPayments = productIds.map((id) => account.badPayments?.[id] ?? []).flat()

  if (badPayments.length === 0) return undefined

  // Return sorted by date (oldest first)
  return [...badPayments].sort((a, b) => a.date.getTime() - b.date.getTime())
}

async function fetchAccountInformation(
  s: CardcomIntegrationServiceData,
  accountId: number,
): Promise<AccountInformation> {
  const account = s.state.accounts[accountId.toString()]
  if (!account) {
    throw new Error(`Account ${accountId} not found`)
  }

  const accountInfo = account.accountInfo
  if (!accountInfo) {
    throw new Error(`Account information for ${accountId} not found`)
  }

  return {
    accountId: accountId.toString(),
    name: accountInfo.name,
    email: accountInfo.email,
    phone: accountInfo.phone,
  }
}

async function createTaxInvoiceDocument(
  s: CardcomIntegrationServiceData,
  invoiceInformation: TaxInvoiceInformation,
  options: {
    sendInvoiceByMail: boolean
    TEST_sendCardcomInvoiceNumber?: number
  },
): Promise<{cardcomInvoiceNumber: number; cardcomDocumentLink: string; cardcomCustomerId: string}> {
  const transactionId = crypto.randomUUID()
  const generatedCustomerId = String(
    invoiceInformation.cardcomCustomerId ?? (Math.random() * 100000) | 0,
  )
  const invoiceToStore = {
    ...invoiceInformation,
    cardcomCustomerId: Number(generatedCustomerId),
  }

  if (s.state.accounts[generatedCustomerId] === undefined) {
    s.state.accounts[generatedCustomerId] = {
      accountInfo: {
        name: 'Test User',
      },
    }
  }

  const cardcomInvoiceNumber =
    options.TEST_sendCardcomInvoiceNumber ?? Object.keys(s.state.payments).length + 1

  s.state.payments[transactionId] = {
    invoiceNumber: cardcomInvoiceNumber,
    isRecurring: false,
    invoiceInformation: invoiceToStore,
    refundTransactionId: undefined,
  }

  return {
    cardcomInvoiceNumber,
    cardcomDocumentLink: `http://invoice-document.example.com/${cardcomInvoiceNumber}`,
    cardcomCustomerId: generatedCustomerId,
  }
}

async function createTaxInvoiceDocumentUrl(
  s: CardcomIntegrationServiceData,
  cardcomInvoiceNumber: string,
) {
  const invoiceDocument = Object.values(s.state.payments).find(
    (inv) => inv.invoiceNumber === parseInt(cardcomInvoiceNumber, 10),
  )

  if (!invoiceDocument)
    throw new Error(
      `Invoice Document ${cardcomInvoiceNumber} not found: ${JSON.stringify(s.state.payments)}`,
    )

  return {url: `http://invoice-document.example.com/${cardcomInvoiceNumber}`}
}

export function assertTaxInvoiceDocumentUrl(url: string, cardcomInvoiceNumber: string) {
  assert(url, `http://invoice-document.example.com/${cardcomInvoiceNumber}`)

  return url
}

export async function _test_simulateCardcomSale(
  s: CardcomIntegrationServiceData,
  sale: TaxInvoiceInformation,
  delivery: DeliveryInformation | undefined,
  webhook: URL | undefined,
  options: {
    cardcomInvoiceNumberToSend?: number
  } = {},
) {
  let cardcomInvoiceNumber: number

  if (!options.cardcomInvoiceNumberToSend) {
    const result = await createTaxInvoiceDocument(s, sale, {
      sendInvoiceByMail: false,
    })

    cardcomInvoiceNumber = result.cardcomInvoiceNumber
  } else {
    cardcomInvoiceNumber = options.cardcomInvoiceNumberToSend
  }

  if (webhook) {
    await simulateCardcomSale(webhook, sale, delivery, cardcomInvoiceNumber.toString(), undefined)
  }
}

export async function _test_simulateCardcomStandingOrder(
  s: CardcomIntegrationServiceData,
  sale: TaxInvoiceInformation,
  delivery: DeliveryInformation | undefined,
  saleWebhook: URL | undefined,
  recurringPaymentWebhook: URL | undefined,
  options: {
    cardcomInvoiceNumberToSend?: number
  } = {},
) {
  let cardcomInvoiceNumber: number
  let cardcomCustomerId = 'stam'

  if (!options.cardcomInvoiceNumberToSend) {
    const result = await createTaxInvoiceDocument(s, sale, {
      sendInvoiceByMail: false,
    })

    cardcomInvoiceNumber = result.cardcomInvoiceNumber
    cardcomCustomerId = result.cardcomCustomerId

    const r = Object.values(s.state.payments).find((p) => p.invoiceNumber === cardcomInvoiceNumber)

    r!.isRecurring = true
  } else {
    cardcomInvoiceNumber = options.cardcomInvoiceNumberToSend
  }

  const recurringOrderId = String((Math.random() * 1_000_000) | 0)

  if (saleWebhook && recurringPaymentWebhook) {
    await simulateCardcomSale(
      saleWebhook,
      sale,
      delivery,
      cardcomInvoiceNumber.toString(),
      recurringOrderId,
    )

    await simulateMasterRecurring(recurringPaymentWebhook, sale, recurringOrderId.toString())
  }

  if (s.state.accounts[cardcomCustomerId] != undefined) {
    s.state.accounts[cardcomCustomerId].recurringPayments = {
      ...s.state.accounts[cardcomCustomerId].recurringPayments,
      [recurringOrderId]: {
        recurringPaymentId: recurringOrderId,
        name: `Test Recurring Payment ${recurringOrderId}`,
        isActive: true,
      },
    }
  }

  return {recurringOrderId}
}

export async function _test_simulateCardcomStandingOrderPayment(
  s: CardcomIntegrationServiceData,
  recurringOrderId: string,
  sale: TaxInvoiceInformation,
  webhook: URL | undefined,
  options: {
    cardcomInvoiceNumberToSend?: number
  } = {},
) {
  let cardcomInvoiceNumber: number

  if (!options.cardcomInvoiceNumberToSend) {
    const result = await createTaxInvoiceDocument(s, sale, {
      sendInvoiceByMail: false,
    })

    cardcomInvoiceNumber = result.cardcomInvoiceNumber
  } else {
    cardcomInvoiceNumber = options.cardcomInvoiceNumberToSend
  }

  if (webhook) {
    await simulateDetailRecurring(sale, recurringOrderId, cardcomInvoiceNumber, webhook)
  }
}

async function refundTransaction(service: CardcomIntegrationServiceData, transactionId: string) {
  const paymentRecord = service.state.payments[transactionId]
  if (!paymentRecord) {
    throw new Error(`Transaction ${transactionId} not found`)
  }

  if (paymentRecord.refundTransactionId) {
    throw new Error(`Transaction ${transactionId} has already been refunded`)
  }

  const refundTransactionId = `refund-${transactionId}`

  paymentRecord.refundTransactionId = refundTransactionId

  return {
    refundTransactionId,
  }
}
