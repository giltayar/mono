import type {CardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import type {
  RecurringPaymentInfo,
  BadPayment,
} from '@giltayar/carmel-tools-cardcom-integration/types'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

type CardcomIntegrationServiceData = {
  state: Parameters<typeof createFakeCardcomIntegrationService>[0]
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
  }
  const sBind: ServiceBind<CardcomIntegrationServiceData> = (f) => bind(f, {state})

  const service: CardcomIntegrationService = {
    enableDisableRecurringPayment: sBind(enableDisableRecurringPayment),
    fetchRecurringPaymentInformation: sBind(fetchRecurringPaymentInformation),
    fetchRecurringPaymentBadPayments: sBind(fetchRecurringPaymentBadPayments),
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
