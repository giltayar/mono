// https://rest.smoove.io/#!/Account/Account_Get

import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import type {
  SmooveContact,
  SmooveContactInList,
  SmooveContactChangeListsOptions,
  SmooveFetchContactOptions,
} from './types.js'

// Re-export types for external consumption
export type {
  SmooveContact,
  SmooveContactInList,
  SmooveContactChangeListsOptions,
  SmooveFetchContactOptions,
} from './types.js'

export interface SmooveIntegrationServiceContext {
  apiKey: string
  apiUrl: string
  cardComRecurringPaymentIdCustomFieldId: string
  cardComAccountIdCustomFieldId: string
}

type SmooveIntegrationServiceData = {
  context: SmooveIntegrationServiceContext
}

export function createSmooveIntegrationService(context: SmooveIntegrationServiceContext) {
  const sBind: ServiceBind<SmooveIntegrationServiceData> = (f) => bind(f, {context})

  return {
    fetchContactsOfList: sBind(fetchContactsOfList),
    fetchSmooveContact: sBind(fetchSmooveContact),
    changeContactLinkedLists: sBind(changeContactLinkedLists),
    updateSmooveContactWithRecurringPayment: sBind(updateSmooveContactWithRecurringPayment),
  }
}

export type SmooveIntegrationService = ReturnType<typeof createSmooveIntegrationService>

export async function fetchContactsOfList(
  s: SmooveIntegrationServiceData,
  listId: number,
): Promise<SmooveContactInList[]> {
  type SmooveApiContact = {
    id: number
    email: string
    phone: string
    cellPhone: string
    lists_Linked: number[]
    customFields: Record<string, string>
    listAssociationTime: string
  }

  let fullResults: SmooveApiContact[] = []
  for (const i of Array.from({length: 100}, (_, i) => i)) {
    const result = await fetchByPage(i + 1)
    if (result.length === 0) {
      break
    }

    fullResults = [...fullResults, ...result]
  }

  return fullResults.map((c: SmooveApiContact) => ({
    id: c.id,
    email: c.email,
    cardcomRecurringPaymentId: c.customFields[s.context.cardComRecurringPaymentIdCustomFieldId],
    cardcomAccountId: c.customFields[s.context.cardComAccountIdCustomFieldId],
    telephone: c.cellPhone || c.phone,
    signupDate: maybeIsoToDate(c.listAssociationTime),
    lists_Linked: c.lists_Linked,
  }))

  async function fetchByPage(page: number): Promise<SmooveApiContact[]> {
    const url = new URL(`Lists/${listId}/Contacts`, s.context.apiUrl)
    url.searchParams.append('fields', 'id,email,listAssociationTime,phone,cellPhone')
    url.searchParams.append('page', String(page))
    url.searchParams.append('itemsPerPage', String(100))
    url.searchParams.append('sort', '-id')
    url.searchParams.append('includeCustomFields', 'true')
    url.searchParams.append('includeLinkedLists', 'true')
    url.searchParams.append('includeListAssociationTime', 'true')

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${s.context.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}, ${await response.text()}`)
    }

    return (await response.json()) as SmooveApiContact[]
  }
}

export async function fetchSmooveContact(
  s: SmooveIntegrationServiceData,
  id: string,
  {by = 'id'}: SmooveFetchContactOptions = {},
): Promise<SmooveContact> {
  const url = new URL(`Contacts/${id}`, s.context.apiUrl)
  url.searchParams.append('by', by === 'id' ? 'ContactId' : 'Email')
  url.searchParams.append('fields', 'id,email,hokNumber,phone,cellPhone')
  url.searchParams.append('includeLinkedLists', 'true')
  url.searchParams.append('includeCustomFields', 'true')

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${s.context.apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}, ${await response.text()}`)
  }

  const result = (await response.json()) as {
    id: number
    email: string
    lists_Linked: number[]
    customFields: Record<string, string>
    cellPhone: string
    phone: string
  }

  return {
    id: result.id,
    email: result.email,
    lists_Linked: result.lists_Linked,
    cardcomRecurringPaymentId:
      result.customFields[s.context.cardComRecurringPaymentIdCustomFieldId],
    cardcomAccountId: result.customFields[s.context.cardComAccountIdCustomFieldId],
    telephone: result.cellPhone || result.phone,
  }
}

export async function changeContactLinkedLists(
  s: SmooveIntegrationServiceData,
  smooveContact: SmooveContact,
  {subscribeTo, unsubscribeFrom}: SmooveContactChangeListsOptions,
): Promise<unknown> {
  const url = new URL(`Contacts/${smooveContact.id}`, s.context.apiUrl)
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${s.context.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({lists_ToSubscribe: subscribeTo, lists_ToUnsubscribe: unsubscribeFrom}),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}, ${await response.text()}`)
  }

  return await response.json()
}

export async function updateSmooveContactWithRecurringPayment(
  s: SmooveIntegrationServiceData,
  email: string,
  accountId: string,
  recurringPaymentId: string,
): Promise<'blacklisted' | 'not-exists' | unknown> {
  const url = new URL(`Contacts/${encodeURIComponent(email)}?by=Email`, s.context.apiUrl)
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${s.context.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      customFields: {
        [s.context.cardComRecurringPaymentIdCustomFieldId]: recurringPaymentId,
        [s.context.cardComAccountIdCustomFieldId]: parseInt(accountId),
      },
    }),
  })

  if (!response.ok) {
    const responseBody = await response.text()
    if (responseBody.includes('ErrBlackListed')) {
      return 'blacklisted'
    } else if (responseBody.includes('ErrExists')) {
      return 'not-exists'
    }
    throw new Error(`Failed to fetch ${url}: ${response.status}, ${responseBody}`)
  }

  return await response.json()
}

function maybeIsoToDate(iso: string): Date {
  if (iso.endsWith('z') || iso.endsWith('Z') || iso.includes('+')) {
    return new Date(iso)
  } else {
    return new Date(iso + '+02:00')
  }
}
