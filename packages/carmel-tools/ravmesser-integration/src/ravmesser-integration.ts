// https://cp.responder.live/settings/api

import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import {
  apiCall,
  createRavmesserApiCaller,
  type RavmesserApiCaller,
  type RavmesserCredentials,
} from './ravmesser-api-call.ts'
import type {
  RavmesserContact,
  RavmesserContactInList,
  RavmesserContactChangeListsOptions,
  RavmesserContactWithIdAndLists,
  RavmesserCustomFields,
  RavmesserFetchContactOptions,
  RavmesserList,
} from './types.ts'

export type {
  RavmesserContact,
  RavmesserContactInList,
  RavmesserContactChangeListsOptions,
  RavmesserContactWithIdAndLists,
  RavmesserCustomFields,
  RavmesserFetchContactOptions,
  RavmesserList,
} from './types.ts'

export interface RavmesserIntegrationServiceContext extends RavmesserCredentials {
  birthdayPersonalFieldId: number
}

type RavmesserIntegrationServiceData = {
  context: RavmesserIntegrationServiceContext
  api: RavmesserApiCaller
  cache: {allListsId: number | undefined}
}

export function createRavmesserIntegrationService(context: RavmesserIntegrationServiceContext) {
  const data: RavmesserIntegrationServiceData = {
    context,
    api: createRavmesserApiCaller(context),
    cache: {allListsId: undefined},
  }
  const sBind: ServiceBind<RavmesserIntegrationServiceData> = (f) => bind(f, data)

  return {
    fetchContactsOfList: sBind(fetchContactsOfList),
    fetchRavmesserContact: sBind(fetchRavmesserContact),
    createRavmesserContact: sBind(createRavmesserContact),
    updateRavmesserContact: sBind(updateRavmesserContact),
    updateRavmesserContactCustomFields: sBind(updateRavmesserContactCustomFields),
    deleteRavmesserContact: sBind(deleteRavmesserContact),
    restoreRavmesserContact: sBind(restoreRavmesserContact),
    changeContactLinkedLists: sBind(changeContactLinkedLists),
    fetchLists: sBind(fetchLists),
    createList: sBind(createList),
  }
}

export type RavmesserIntegrationService = ReturnType<typeof createRavmesserIntegrationService>

const PAGE_SIZE = 500

async function fetchContactsOfList(
  s: RavmesserIntegrationServiceData,
  listId: number,
): Promise<RavmesserContactInList[]> {
  type ApiMembership = ApiSubscriber & {subscriber_id: number | string; created: string}

  const memberships: ApiMembership[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = (await apiCall(
      s.api,
      'GET',
      `lists/${listId}/subscribers?limit=${PAGE_SIZE}&offset=${offset}`,
    )) as {data: ApiMembership[]; total: number}

    memberships.push(...response.data)

    if (response.data.length === 0 || memberships.length >= response.total) {
      break
    }
  }

  return memberships.map((membership) => ({
    ...toContact(s, {...membership, id: membership.subscriber_id}),
    signupDate: apiDateToDate(membership.created),
  }))
}

async function fetchRavmesserContact(
  s: RavmesserIntegrationServiceData,
  idOrEmail: number | string,
  {by = 'id'}: RavmesserFetchContactOptions = {},
): Promise<RavmesserContactWithIdAndLists> {
  const id = by === 'id' ? idOrEmail : await findIdByEmail(s, String(idOrEmail))

  const response = (await apiCall(s.api, 'GET', `subscribers/${encodeURIComponent(id)}`)) as {
    status: boolean
    data: ApiSubscriber | []
  }

  if (!response.status || Array.isArray(response.data)) {
    throw new Error(`Contact not found: ${idOrEmail}`)
  }

  return {
    ...toContact(s, response.data),
    lists_Linked: (response.data.lists ?? []).map((list) => Number(list.id)),
  }
}

async function createRavmesserContact(
  s: RavmesserIntegrationServiceData,
  contact: RavmesserContact,
): Promise<{ravmesserId: number} | 'blacklisted'> {
  const allListsId = await resolveAllListsId(s)

  try {
    // Posting an existing email updates it and subscribes it to the list
    const response = (await apiCall(
      s.api,
      'POST',
      `lists/${allListsId}/subscribers`,
      toApiSubscriber(s, contact),
    )) as {createdId: number | string}

    return {ravmesserId: Number(response.createdId)}
  } catch (error: any) {
    if (
      error.code === 'ERR_X_STATUS_CODE_NOT_OK' &&
      error.status === 400 &&
      isBlocked(error.body)
    ) {
      return 'blacklisted'
    }

    throw error
  }
}

async function updateRavmesserContact(
  s: RavmesserIntegrationServiceData,
  ravmesserId: number,
  contact: RavmesserContact,
): Promise<void> {
  await apiCall(s.api, 'PUT', `subscribers/${ravmesserId}`, toApiSubscriber(s, contact))
}

async function updateRavmesserContactCustomFields(
  s: RavmesserIntegrationServiceData,
  ravmesserId: number,
  customFields: RavmesserCustomFields,
): Promise<void> {
  const personalFields: Record<string, string | number | boolean> = {}

  for (const [fieldId, value] of Object.entries(customFields)) {
    personalFields[fieldId] = value instanceof Date ? toApiDate(value) : value
  }

  // RavMesser ignores a PUT that carries nothing but `personal_fields`
  const {email} = await fetchRavmesserContact(s, ravmesserId)

  await apiCall(s.api, 'PUT', `subscribers/${ravmesserId}`, {
    email,
    personal_fields: personalFields,
  })
}

async function deleteRavmesserContact(
  s: RavmesserIntegrationServiceData,
  ravmesserId: number,
): Promise<void> {
  await apiCall(s.api, 'PUT', `subscribers/${ravmesserId}`, {unsubscribed: 1})
}

async function restoreRavmesserContact(
  s: RavmesserIntegrationServiceData,
  ravmesserId: number,
): Promise<void> {
  await apiCall(s.api, 'PUT', `subscribers/${ravmesserId}`, {unsubscribed: 0})
}

async function changeContactLinkedLists(
  s: RavmesserIntegrationServiceData,
  ravmesserId: number,
  {subscribeTo, unsubscribeFrom}: RavmesserContactChangeListsOptions,
): Promise<void> {
  const contact = await fetchRavmesserContact(s, ravmesserId)

  await Promise.all([
    ...subscribeTo.map((listId) =>
      apiCall(s.api, 'POST', `lists/${listId}/subscribers`, toApiSubscriber(s, contact)),
    ),
    ...unsubscribeFrom.map((listId) =>
      apiCall(s.api, 'DELETE', `lists/${listId}/subscribers/${ravmesserId}`),
    ),
  ])
}

async function fetchLists(s: RavmesserIntegrationServiceData): Promise<RavmesserList[]> {
  return (await fetchApiLists(s)).map((list) => ({id: Number(list.id), name: list.name}))
}

async function createList(s: RavmesserIntegrationServiceData, name: string): Promise<number> {
  const response = (await apiCall(s.api, 'POST', 'lists', {name})) as {createdId: number | string}

  return Number(response.createdId)
}

type ApiList = {id: number | string; name: string; is_all_lists: number}

type ApiSubscriber = {
  id: number | string
  first: string
  last: string
  email: string
  phone: string
  personal_fields?: Record<string, unknown> | unknown[]
  lists?: {id: number | string}[]
}

async function fetchApiLists(s: RavmesserIntegrationServiceData): Promise<ApiList[]> {
  const lists: ApiList[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = (await apiCall(s.api, 'GET', `lists?limit=${PAGE_SIZE}&offset=${offset}`)) as {
      data: ApiList[]
      count: number
    }

    lists.push(...response.data)

    if (response.data.length === 0 || lists.length >= response.count) {
      break
    }
  }

  return lists
}

async function resolveAllListsId(s: RavmesserIntegrationServiceData): Promise<number> {
  if (s.cache.allListsId !== undefined) {
    return s.cache.allListsId
  }

  const allLists = (await fetchApiLists(s)).find((list) => list.is_all_lists)

  if (allLists === undefined) {
    throw new Error('No "all lists" list found in the RavMesser account')
  }

  s.cache.allListsId = Number(allLists.id)

  return s.cache.allListsId
}

async function findIdByEmail(s: RavmesserIntegrationServiceData, email: string): Promise<number> {
  const response = (await apiCall(
    s.api,
    'GET',
    `subscribers?email=${encodeURIComponent(email)}`,
  )) as {
    data: ApiSubscriber[]
  }

  if (response.data.length === 0) {
    throw new Error(`Contact not found: ${email}`)
  }

  return Number(response.data[0].id)
}

function toContact(
  s: RavmesserIntegrationServiceData,
  subscriber: ApiSubscriber,
): RavmesserContact & {id: number} {
  const personalFields = subscriber.personal_fields

  return {
    id: Number(subscriber.id),
    firstName: subscriber.first,
    lastName: subscriber.last,
    email: subscriber.email,
    telephone: subscriber.phone || undefined,
    birthday: Array.isArray(personalFields)
      ? undefined
      : personalFieldToDate(personalFields?.[s.context.birthdayPersonalFieldId]),
  }
}

function toApiSubscriber(
  s: RavmesserIntegrationServiceData,
  contact: RavmesserContact,
): Record<string, unknown> {
  return {
    email: contact.email,
    first: contact.firstName,
    last: contact.lastName,
    ...(contact.telephone !== undefined ? {phone: contact.telephone} : {}),
    ...(contact.birthday !== undefined
      ? {personal_fields: {[s.context.birthdayPersonalFieldId]: toApiDate(contact.birthday)}}
      : {}),
  }
}

function isBlocked(body: string): boolean {
  return /forbidden|blocked|banned|blacklist/i.test(body)
}

function toApiDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// Date personal fields are written as "YYYY-MM-DD" but read back as {year, month, day}
function personalFieldToDate(value: unknown): Date | undefined {
  if (typeof value === 'string') {
    return value ? new Date(value.slice(0, 10)) : undefined
  }

  if (value === null || typeof value !== 'object') {
    return undefined
  }

  const {year, month, day} = value as {year: number; month: number; day: number}

  return year ? new Date(Date.UTC(year, month - 1, day)) : undefined
}

// RavMesser returns "YYYY-MM-DD HH:mm:ss" with no timezone, in Israel time
function apiDateToDate(date: string): Date {
  return new Date(date.replace(' ', 'T') + '+02:00')
}
