import type {RavmesserIntegrationService} from '@giltayar/carmel-tools-ravmesser-integration/service'
import type {
  RavmesserContact,
  RavmesserContactInList,
  RavmesserContactChangeListsOptions,
  RavmesserContactWithIdAndLists,
  RavmesserCustomFields,
  RavmesserFetchContactOptions,
  RavmesserList,
} from '@giltayar/carmel-tools-ravmesser-integration/types'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

type FakeContact = {
  id: number
  firstName: string
  lastName: string
  email: string
  telephone: string | undefined
  birthday?: Date
  lists: number[]
  signupDate: Date
  unsubscribed?: boolean
  customFields?: RavmesserCustomFields
}

type FakeList = {id: number; name: string; isAllLists?: boolean}

type FakeState = {
  contacts: Record<number, FakeContact>
  lists: Record<number, FakeList>
  blacklistedEmails: Set<string>
}

type RavmesserIntegrationServiceData = {
  state: FakeState
}

export function createFakeRavmesserIntegrationService(context: {
  contacts: Record<number, FakeContact>
  lists: Record<number, FakeList>
  blacklistedEmails?: Set<string>
}) {
  const state = initialState()
  const sBind: ServiceBind<RavmesserIntegrationServiceData> = (f) => bind(f, {state})

  const service: RavmesserIntegrationService = {
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

  return {
    ...service,
    _test_reset_data: () => {
      Object.assign(state, initialState())
    },
    _test_isContactUnsubscribed: (id: number) => !!state.contacts[id]?.unsubscribed,
    _test_getLists: (id: number) => state.contacts[id]?.lists,
    _test_getCustomFields: (id: number) => state.contacts[id]?.customFields,
  }

  function initialState(): FakeState {
    return {
      contacts: structuredClone(context.contacts),
      lists: structuredClone(context.lists),
      blacklistedEmails: new Set(context.blacklistedEmails ?? []),
    }
  }
}

export type FakeRavmesserIntegrationService = ReturnType<
  typeof createFakeRavmesserIntegrationService
>

async function fetchContactsOfList(
  s: RavmesserIntegrationServiceData,
  listId: number,
): Promise<RavmesserContactInList[]> {
  return Object.values(s.state.contacts)
    .filter((contact) => contact.lists.includes(listId))
    .sort((a, b) => a.id - b.id)
    .map((contact) => ({...toContact(contact), signupDate: contact.signupDate}))
}

async function fetchRavmesserContact(
  s: RavmesserIntegrationServiceData,
  idOrEmail: number | string,
  {by = 'id'}: RavmesserFetchContactOptions = {},
): Promise<RavmesserContactWithIdAndLists> {
  const contact =
    by === 'id'
      ? s.state.contacts[Number(idOrEmail)]
      : Object.values(s.state.contacts).find((c) => c.email === String(idOrEmail))

  if (!contact) {
    throw new Error(`Contact not found: ${idOrEmail}`)
  }

  return {...toContact(contact), lists_Linked: [...contact.lists]}
}

async function createRavmesserContact(
  s: RavmesserIntegrationServiceData,
  contact: RavmesserContact,
): Promise<{ravmesserId: number} | 'blacklisted'> {
  if (s.state.blacklistedEmails.has(contact.email)) {
    return 'blacklisted'
  }

  const existingContact = Object.values(s.state.contacts).find((c) => c.email === contact.email)

  if (existingContact) {
    await updateRavmesserContact(s, existingContact.id, contact)

    return {ravmesserId: existingContact.id}
  }

  const newId = Math.max(0, ...Object.keys(s.state.contacts).map(Number)) + 1

  s.state.contacts[newId] = {
    id: newId,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    telephone: contact.telephone,
    birthday: contact.birthday,
    lists: [allListsId(s)],
    signupDate: new Date(),
  }

  return {ravmesserId: newId}
}

async function updateRavmesserContact(
  s: RavmesserIntegrationServiceData,
  ravmesserId: number,
  contact: RavmesserContact,
): Promise<void> {
  const existingContact = existing(s, ravmesserId)

  existingContact.firstName = contact.firstName
  existingContact.lastName = contact.lastName
  existingContact.email = contact.email
  existingContact.telephone = contact.telephone ?? existingContact.telephone
  existingContact.birthday = contact.birthday ?? existingContact.birthday
}

async function updateRavmesserContactCustomFields(
  s: RavmesserIntegrationServiceData,
  ravmesserId: number,
  customFields: RavmesserCustomFields,
): Promise<void> {
  const contact = existing(s, ravmesserId)

  contact.customFields = {...contact.customFields, ...customFields}
}

async function deleteRavmesserContact(
  s: RavmesserIntegrationServiceData,
  ravmesserId: number,
): Promise<void> {
  existing(s, ravmesserId).unsubscribed = true
}

async function restoreRavmesserContact(
  s: RavmesserIntegrationServiceData,
  ravmesserId: number,
): Promise<void> {
  existing(s, ravmesserId).unsubscribed = false
}

async function changeContactLinkedLists(
  s: RavmesserIntegrationServiceData,
  ravmesserId: number,
  {subscribeTo, unsubscribeFrom}: RavmesserContactChangeListsOptions,
): Promise<void> {
  const contact = existing(s, ravmesserId)

  for (const listId of subscribeTo) {
    if (!contact.lists.includes(listId)) {
      contact.lists.push(listId)
    }
  }

  for (const listId of unsubscribeFrom) {
    const index = contact.lists.indexOf(listId)

    if (index !== -1) {
      contact.lists.splice(index, 1)
    }
  }
}

async function fetchLists(s: RavmesserIntegrationServiceData): Promise<RavmesserList[]> {
  return Object.values(s.state.lists).map((list) => ({id: list.id, name: list.name}))
}

async function createList(s: RavmesserIntegrationServiceData, name: string): Promise<number> {
  const newId = Math.max(0, ...Object.keys(s.state.lists).map(Number)) + 1

  s.state.lists[newId] = {id: newId, name}

  return newId
}

function existing(s: RavmesserIntegrationServiceData, ravmesserId: number): FakeContact {
  const contact = s.state.contacts[ravmesserId]

  if (!contact) {
    throw new Error(`Contact not found: ${ravmesserId}`)
  }

  return contact
}

function allListsId(s: RavmesserIntegrationServiceData): number {
  const allLists = Object.values(s.state.lists).find((list) => list.isAllLists)

  if (!allLists) {
    throw new Error('No "all lists" list found in the RavMesser account')
  }

  return allLists.id
}

function toContact(contact: FakeContact): RavmesserContact & {id: number} {
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    telephone: contact.telephone,
    birthday: contact.birthday,
  }
}
