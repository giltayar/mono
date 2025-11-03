import type {
  CardcomIntegrationService,
  TaxInvoiceInformation,
} from '@giltayar/carmel-tools-cardcom-integration/service'
import type {
  RecurringPaymentInfo,
  BadPayment,
} from '@giltayar/carmel-tools-cardcom-integration/types'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import assert from 'node:assert'
import {simulateCardcomSale} from './cardcom-webhook-simulation.ts'

type CardcomIntegrationServiceData = {
  state: Parameters<typeof createFakeCardcomIntegrationService>[0] & {
    taxInvoiceDocuments: TaxInvoiceInformation[]
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

export function createFakeCardcomIntegrationService(context: {
  accounts: Record<
    string,
    {
      recurringPayments: Record<
        string,
        {
          recurringPaymentId: string
          name: string
          isActive: boolean
        }
      >
      badPayments: Record<string, BadPayment[]>
    }
  >
}) {
  const state: CardcomIntegrationServiceData['state'] = {
    accounts: structuredClone(context.accounts),
    taxInvoiceDocuments: [],
  }
  const sBind: ServiceBind<CardcomIntegrationServiceData> = (f) => bind(f, {state})

  const service: CardcomIntegrationService = {
    enableDisableRecurringPayment: sBind(enableDisableRecurringPayment),
    fetchRecurringPaymentInformation: sBind(fetchRecurringPaymentInformation),
    fetchRecurringPaymentBadPayments: sBind(fetchRecurringPaymentBadPayments),
    createTaxInvoiceDocument: sBind(createTaxInvoiceDocument),
    createTaxInvoiceDocumentUrl: sBind(createTaxInvoiceDocumentUrl),
  }

  return {
    ...service,
    _test_getRecurringPaymentStatus: async (
      accountId: string,
      recurringPaymentId: string,
    ): Promise<boolean | undefined> => {
      const account = state.accounts[accountId]
      if (!account) return undefined

      const recurringPayment = Object.values(account.recurringPayments).find(
        (rp) => rp.recurringPaymentId === recurringPaymentId,
      )
      return recurringPayment?.isActive
    },
    _test_getTaxInvoiceDocument: async (
      cardcomInvoiceNumber: string,
    ): Promise<TaxInvoiceInformation | undefined> => {
      const invoiceDocument = state.taxInvoiceDocuments[parseInt(cardcomInvoiceNumber) - 1]
      return invoiceDocument
    },
    _test_simulateCardcomSale: sBind(_test_simulateCardcomSale),
  }
}

async function enableDisableRecurringPayment(
  s: CardcomIntegrationServiceData,
  cardcomRecurringPaymentId: string,
  action: 'enable' | 'disable',
): Promise<Record<string, string>> {
  for (const account of Object.values(s.state.accounts)) {
    for (const recurringPayment of Object.values(account.recurringPayments)) {
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
  const recurringPayment = Object.values(account.recurringPayments).find((rp) =>
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

  const badPayments = productIds.map((id) => account.badPayments[id] ?? []).flat()

  if (badPayments.length === 0) return undefined

  // Return sorted by date (oldest first)
  return [...badPayments].sort((a, b) => a.date.getTime() - b.date.getTime())
}

async function createTaxInvoiceDocument(
  s: CardcomIntegrationServiceData,
  invoiceInformation: TaxInvoiceInformation,
  options: {
    sendInvoiceByMail: boolean
    TEST_sendCardcomInvoiceNumber?: number
  },
): Promise<{cardcomInvoiceNumber: number; cardcomDocumentLink: string; cardcomCustomerId: string}> {
  const generatedCustomerId = invoiceInformation.cardcomCustomerId ?? (Math.random() * 100000) | 0
  const invoiceToStore = {
    ...invoiceInformation,
    cardcomCustomerId: generatedCustomerId,
  }
  s.state.taxInvoiceDocuments.push(invoiceToStore)

  const cardcomInvoiceNumber =
    options.TEST_sendCardcomInvoiceNumber ?? s.state.taxInvoiceDocuments.length
  return {
    cardcomInvoiceNumber,
    cardcomDocumentLink: `http://invoice-document.example.com/${cardcomInvoiceNumber}`,
    cardcomCustomerId: generatedCustomerId.toString(),
  }
}

async function createTaxInvoiceDocumentUrl(
  s: CardcomIntegrationServiceData,
  cardcomInvoiceNumber: string,
) {
  const invoiceDocument = s.state.taxInvoiceDocuments[parseInt(cardcomInvoiceNumber) - 1]

  if (!invoiceDocument) throw new Error(`Invoice Document ${cardcomInvoiceNumber} not found`)

  return {url: `http://invoice-document.example.com/${cardcomInvoiceNumber}`}
}

export function assertTaxInvoiceDocumentUrl(url: string, cardcomInvoiceNumber: string) {
  assert(url, `http://invoice-document.example.com/${cardcomInvoiceNumber}`)

  return url
}

export async function _test_simulateCardcomSale(
  s: CardcomIntegrationServiceData,
  salesEventNumber: number,
  sale: TaxInvoiceInformation,
  delivery: DeliveryInformation | undefined,
  serverInfo: {
    secret: string
    baseUrl: string
  },
  options: {
    cardcomInvoiceNumberToSend?: number
  } = {},
) {
  assert.ok(
    !options.cardcomInvoiceNumberToSend ||
      s.state.taxInvoiceDocuments[options.cardcomInvoiceNumberToSend + 1],
  )
  const {cardcomInvoiceNumber} = options.cardcomInvoiceNumberToSend
    ? {cardcomInvoiceNumber: options.cardcomInvoiceNumberToSend}
    : await createTaxInvoiceDocument(s, sale, {
        sendInvoiceByMail: false,
        TEST_sendCardcomInvoiceNumber: options.cardcomInvoiceNumberToSend,
      })

  await simulateCardcomSale(
    salesEventNumber,
    sale,
    delivery,
    cardcomInvoiceNumber.toString(),
    serverInfo,
  )
}
