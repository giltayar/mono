import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {
  SmooveContactInList,
  SmooveContactChangeListsOptions,
  SmooveFetchContactOptions,
  SmooveContactWithIdAndLists,
  SmooveContact,
} from '@giltayar/carmel-tools-smoove-integration/types'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

type SmooveIntegrationServiceData = {
  state: Parameters<typeof createFakeSmooveIntegrationService>[0]
}

export function createFakeSmooveIntegrationService(context: {
  contacts: Record<
    number,
    {
      id: number
      email: string
      firstName: string
      lastName: string
      telephone: string
      lists: number[]
      signupDate: Date
      birthday?: Date
      isDeleted?: boolean
    }
  >
  lists: Record<number, {id: number; name: string}>
  blacklistedEmails?: Set<string>
}) {
  const state: SmooveIntegrationServiceData['state'] = {
    contacts: structuredClone(context.contacts),
    lists: structuredClone(context.lists),
  }
  const sBind: ServiceBind<SmooveIntegrationServiceData> = (f) => bind(f, {state})

  const service: SmooveIntegrationService = {
    fetchContactsOfList: sBind(fetchContactsOfList),
    fetchSmooveContact: sBind(fetchSmooveContact),
    createSmooveContact: sBind(createSmooveContact),
    updateSmooveContact: sBind(updateSmooveContact),
    deleteSmooveContact: sBind(deleteSmooveContact),
    restoreSmooveContact: sBind(restoreSmooveContact),
    changeContactLinkedLists: sBind(changeContactLinkedLists),
    fetchLists: sBind(fetchLists),
  }

  return {
    ...service,
    _test_isContactDeleted: (id: number) => !!state.contacts[id].isDeleted,
  }
}

async function fetchContactsOfList(
  s: SmooveIntegrationServiceData,
  listId: number,
): Promise<SmooveContactInList[]> {
  return Object.values(s.state.contacts)
    .filter((contact) => contact.lists.includes(listId))
    .map((contact) => ({
      id: contact.id,
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      telephone: contact.telephone,
      birthday: undefined,
      lists_Linked: [...contact.lists],
      signupDate: contact.signupDate,
    }))
    .sort((a, b) => b.id - a.id) // Sort by id descending like the real API
}

async function fetchSmooveContact(
  s: SmooveIntegrationServiceData,
  id: number | string,
  {by = 'id'}: SmooveFetchContactOptions = {},
): Promise<SmooveContactWithIdAndLists> {
  let contact: (typeof s.state.contacts)[number] | undefined

  if (by === 'id') {
    contact = s.state.contacts[typeof id == 'number' ? id : parseInt(id)]
  } else if (by === 'email') {
    contact = Object.values(s.state.contacts).find((c) => c.email === String(id))
  }

  if (!contact) {
    throw new Error(`Contact not found: ${id}`)
  }

  return {
    id: contact.id,
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    telephone: contact.telephone,
    birthday: contact.birthday,
    lists_Linked: [...contact.lists],
  }
}

async function changeContactLinkedLists(
  s: SmooveIntegrationServiceData,
  smooveId: number,
  {subscribeTo, unsubscribeFrom}: SmooveContactChangeListsOptions,
): Promise<unknown> {
  const contact = s.state.contacts[smooveId]
  if (!contact) {
    throw new Error(`Contact ${smooveId} not found`)
  }

  // Add new subscriptions
  for (const listId of subscribeTo) {
    if (!contact.lists.includes(listId)) {
      contact.lists.push(listId)
    }
  }

  // Remove unsubscriptions
  for (const listId of unsubscribeFrom) {
    const index = contact.lists.indexOf(listId)
    if (index !== -1) {
      contact.lists.splice(index, 1)
    }
  }

  return {success: true}
}

async function createSmooveContact(
  s: SmooveIntegrationServiceData,
  contact: SmooveContact,
): Promise<{smooveId: number} | 'blacklisted'> {
  if (s.state.blacklistedEmails?.has(contact.email)) {
    return 'blacklisted'
  }
  const existingContact = Object.values(s.state.contacts).find((c) => c.email === contact.email)

  if (existingContact) {
    existingContact.telephone = contact.telephone ?? existingContact.telephone
    existingContact.birthday = contact.birthday ?? existingContact.birthday
    existingContact.email = contact.email ?? existingContact.email
    existingContact.firstName = contact.firstName ?? existingContact.firstName
    existingContact.lastName = contact.lastName ?? existingContact.lastName

    return {smooveId: existingContact.id}
  }

  const newId = Math.max(0, ...Object.keys(s.state.contacts).map(Number)) + 1

  s.state.contacts[newId] = {
    id: newId,
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    telephone: contact.telephone ?? '',
    birthday: contact.birthday,
    lists: [] as number[],
    signupDate: new Date(),
    isDeleted: false,
  }

  return {smooveId: newId}
}

async function updateSmooveContact(
  s: SmooveIntegrationServiceData,
  smooveId: number,
  contact: SmooveContact,
): Promise<void> {
  const existingContact = s.state.contacts[smooveId]
  if (!existingContact) {
    throw new Error(`Contact ${smooveId} not found`)
  }

  // Update the contact fields
  existingContact.email = contact.email
  if (contact.telephone !== undefined) {
    existingContact.telephone = contact.telephone
  }
  existingContact.firstName = contact.firstName
  existingContact.lastName = contact.lastName
  existingContact.birthday = contact.birthday
}

async function deleteSmooveContact(
  s: SmooveIntegrationServiceData,
  smooveId: number,
): Promise<void> {
  const contact = s.state.contacts[smooveId]
  if (!contact) {
    throw new Error(`Contact ${smooveId} not found`)
  }

  // Mark as blacklisted (soft delete)
  contact.isDeleted = true
}

async function restoreSmooveContact(
  s: SmooveIntegrationServiceData,
  smooveId: number,
): Promise<void> {
  const contact = s.state.contacts[smooveId]
  if (!contact) {
    throw new Error(`Contact ${smooveId} not found`)
  }

  // Remove blacklisted status (restore)
  contact.isDeleted = false
}

async function fetchLists(s: SmooveIntegrationServiceData) {
  return Object.values(s.state.lists).map((list) => ({
    id: list.id,
    name: list.name,
  }))
}
