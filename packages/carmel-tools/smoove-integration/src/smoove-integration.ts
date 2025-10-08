// https://rest.smoove.io/#!/Account/Account_Get

import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import {
  fetchAsJson,
  fetchAsJsonWithJsonBody,
  fetchAsText,
  fetchAsTextWithJsonBody,
} from '@giltayar/http-commons'
import type {
  SmooveContact,
  SmooveContactInList,
  SmooveContactChangeListsOptions,
  SmooveFetchContactOptions,
  SmooveList,
  SmooveContactWithIdAndLists,
} from './types.js'

// Re-export types for external consumption
export type {
  SmooveContact,
  SmooveContactInList,
  SmooveContactChangeListsOptions,
  SmooveFetchContactOptions,
  SmooveList,
} from './types.js'

export interface SmooveIntegrationServiceContext {
  apiKey: string
  apiUrl: string
}

type SmooveIntegrationServiceData = {
  context: SmooveIntegrationServiceContext
}

export function createSmooveIntegrationService(context: SmooveIntegrationServiceContext) {
  const sBind: ServiceBind<SmooveIntegrationServiceData> = (f) => bind(f, {context})

  return {
    fetchContactsOfList: sBind(fetchContactsOfList),
    fetchSmooveContact: sBind(fetchSmooveContact),
    createSmooveContact: sBind(createSmooveContact),
    updateSmooveContact: sBind(updateSmooveContact),
    deleteSmooveContact: sBind(deleteSmooveContact),
    restoreSmooveContact: sBind(restoreSmooveContact),
    changeContactLinkedLists: sBind(changeContactLinkedLists),
    fetchLists: sBind(fetchLists),
  }
}

export type SmooveIntegrationService = ReturnType<typeof createSmooveIntegrationService>

async function fetchContactsOfList(
  s: SmooveIntegrationServiceData,
  listId: number,
): Promise<SmooveContactInList[]> {
  type SmooveApiContact = {
    id: number
    firstName: string
    lastName: string
    email: string
    phone: string
    cellPhone: string
    lists_Linked: number[]
    dateOfBirth: string
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
    firstName: c.firstName,
    lastName: c.lastName,
    telephone: c.cellPhone || c.phone,
    signupDate: maybeIsoToDate(c.listAssociationTime),
    birthday: c.dateOfBirth ? maybeIsoToDate(c.dateOfBirth) : undefined,
    lists_Linked: c.lists_Linked,
  }))

  async function fetchByPage(page: number): Promise<SmooveApiContact[]> {
    const url = new URL(`Lists/${listId}/Contacts`, s.context.apiUrl)
    url.searchParams.append('fields', 'id,email,listAssociationTime,phone,cellPhone,dateOfBirth')
    url.searchParams.append('page', String(page))
    url.searchParams.append('itemsPerPage', String(100))
    url.searchParams.append('sort', '-id')
    url.searchParams.append('includeCustomFields', 'false')
    url.searchParams.append('includeLinkedLists', 'true')
    url.searchParams.append('includeListAssociationTime', 'true')

    return (await fetchAsJson(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${s.context.apiKey}`,
      },
    })) as SmooveApiContact[]
  }
}

async function fetchSmooveContact(
  s: SmooveIntegrationServiceData,
  id: number | string,
  {by = 'id'}: SmooveFetchContactOptions = {},
): Promise<SmooveContactWithIdAndLists> {
  const url = new URL(`Contacts/${id}`, s.context.apiUrl)
  url.searchParams.append('by', by === 'id' ? 'ContactId' : 'Email')
  url.searchParams.append('fields', 'id,email,hokNumber,phone,cellPhone,dateOfBirth')
  url.searchParams.append('includeCustomFields', 'false')
  url.searchParams.append('includeLinkedLists', 'true')

  const result = (await fetchAsJson(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${s.context.apiKey}`,
      'Content-Type': 'application/json',
    },
  })) as {
    id: number
    firstName: string
    lastName: string
    email: string
    lists_Linked: number[]
    cellPhone: string
    dateOfBirth: string
    phone: string
  }

  return {
    id: result.id,
    email: result.email,
    firstName: result.firstName,
    lastName: result.lastName,
    lists_Linked: result.lists_Linked,
    telephone: result.cellPhone || result.phone,
    birthday: result.dateOfBirth ? maybeIsoToDate(result.dateOfBirth) : undefined,
  }
}

async function createSmooveContact(
  s: SmooveIntegrationServiceData,
  contact: SmooveContact,
): Promise<{smooveId: number}> {
  const url = new URL(`Contacts?updateIfExists=true&restoreIfDeleted=true`, s.context.apiUrl)

  const response = (await fetchAsJsonWithJsonBody(
    url,
    removeUndefinedFields({
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.telephone,
      cellPhone: contact.telephone,
      dateOfBirth: contact.birthday ? contact.birthday.toISOString() : undefined,
    }),
    {
      headers: {
        Authorization: `Bearer ${s.context.apiKey}`,
      },
    },
  )) as {id: number}

  return {smooveId: response.id}
}

async function updateSmooveContact(
  s: SmooveIntegrationServiceData,
  smooveId: number,
  contact: SmooveContact,
): Promise<void> {
  const url = new URL(`Contacts/${encodeURIComponent(smooveId)}?by=ContactId`, s.context.apiUrl)

  await fetchAsJsonWithJsonBody(
    url,
    removeUndefinedFields({
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.telephone,
      cellPhone: contact.telephone,
      dateOfBirth: contact.birthday ? contact.birthday.toISOString() : undefined,
    }),
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${s.context.apiKey}`,
      },
    },
  )
}

async function deleteSmooveContact(
  s: SmooveIntegrationServiceData,
  smooveId: number,
): Promise<void> {
  const url = new URL(
    `Contacts/${encodeURIComponent(smooveId)}/Unsubscribe?by=ContactId`,
    s.context.apiUrl,
  )

  await fetchAsTextWithJsonBody(
    url,
    {reason: 'deleted by backoffice'},
    {
      headers: {
        Authorization: `Bearer ${s.context.apiKey}`,
      },
    },
  )
}

async function restoreSmooveContact(
  s: SmooveIntegrationServiceData,
  smooveId: number,
): Promise<void> {
  const url = new URL(
    `Contacts/${encodeURIComponent(smooveId)}/Resubscribe?by=ContactId`,
    s.context.apiUrl,
  )

  await fetchAsText(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${s.context.apiKey}`,
    },
  })
}

async function changeContactLinkedLists(
  s: SmooveIntegrationServiceData,
  smooveId: number,
  {subscribeTo, unsubscribeFrom}: SmooveContactChangeListsOptions,
): Promise<unknown> {
  const url = new URL(`Contacts/${smooveId}`, s.context.apiUrl)
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

export async function fetchLists(s: SmooveIntegrationServiceData): Promise<SmooveList[]> {
  type SmooveApiGroup = {
    id: number
    name: string
  }

  let fullResults: SmooveApiGroup[] = []
  for (let i = 1; ; i += 1) {
    const result = await fetchByPage(i)
    if (result.length === 0) {
      break
    }

    fullResults = [...fullResults, ...result]

    if (result.length < 500) {
      break
    }
  }

  return fullResults

  async function fetchByPage(page: number): Promise<SmooveApiGroup[]> {
    const url = new URL('Lists', s.context.apiUrl)
    // Yeah, it's called page but it isn't really
    url.searchParams.append('page', String(page))
    url.searchParams.append('itemsPerPage', String(500))

    const result = (await fetchAsJson(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${s.context.apiKey}`,
      },
    })) as SmooveApiGroup[]

    return result
  }
}

function maybeIsoToDate(iso: string): Date {
  if (iso.endsWith('z') || iso.endsWith('Z') || iso.includes('+')) {
    return new Date(iso)
  } else {
    return new Date(iso + '+02:00')
  }
}

function removeUndefinedFields(
  options: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {}

  for (const [k, v] of Object.entries(options)) {
    if (v !== undefined) {
      result[k] = v
    }
  }

  return result
}
