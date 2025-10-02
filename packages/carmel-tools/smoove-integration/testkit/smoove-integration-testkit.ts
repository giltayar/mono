import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {
  SmooveContact,
  SmooveContactInList,
  SmooveContactChangeListsOptions,
  SmooveFetchContactOptions,
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
      telephone: string
      cardcomRecurringPaymentId: string
      cardcomAccountId: string
      lists: number[]
      signupDate: Date
      isBlacklisted?: boolean
    }
  >
  lists: Record<number, {id: number; name: string}>
}) {
  const state: SmooveIntegrationServiceData['state'] = {
    contacts: structuredClone(context.contacts),
    lists: structuredClone(context.lists),
  }
  const sBind: ServiceBind<SmooveIntegrationServiceData> = (f) => bind(f, {state})

  const service: SmooveIntegrationService = {
    fetchContactsOfList: sBind(fetchContactsOfList),
    fetchSmooveContact: sBind(fetchSmooveContact),
    changeContactLinkedLists: sBind(changeContactLinkedLists),
    updateSmooveContactWithRecurringPayment: sBind(updateSmooveContactWithRecurringPayment),
    fetchLists: sBind(fetchLists),
  }

  return {
    ...service,
    _test_addContact: async (contact: {
      id: number
      email: string
      telephone: string
      cardcomRecurringPaymentId: string
      cardcomAccountId: string
      lists: number[]
      signupDate: Date
      isBlacklisted?: boolean
    }) => {
      state.contacts[contact.id] = structuredClone(contact)
    },
    _test_addList: async (list: {id: number; name: string}) => {
      state.lists[list.id] = structuredClone(list)
    },
    _test_setContactBlacklisted: async (contactId: number, isBlacklisted: boolean) => {
      const contact = state.contacts[contactId]
      if (contact) {
        contact.isBlacklisted = isBlacklisted
      }
    },
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
      telephone: contact.telephone,
      cardcomRecurringPaymentId: contact.cardcomRecurringPaymentId,
      cardcomAccountId: contact.cardcomAccountId,
      lists_Linked: [...contact.lists],
      signupDate: contact.signupDate,
    }))
    .sort((a, b) => b.id - a.id) // Sort by id descending like the real API
}

async function fetchSmooveContact(
  s: SmooveIntegrationServiceData,
  id: string,
  {by = 'id'}: SmooveFetchContactOptions = {},
): Promise<SmooveContact> {
  let contact: (typeof s.state.contacts)[number] | undefined

  if (by === 'id') {
    contact = s.state.contacts[parseInt(id)]
  } else if (by === 'email') {
    contact = Object.values(s.state.contacts).find((c) => c.email === id)
  }

  if (!contact) {
    throw new Error(`Contact not found: ${id}`)
  }

  return {
    id: contact.id,
    email: contact.email,
    telephone: contact.telephone,
    cardcomRecurringPaymentId: contact.cardcomRecurringPaymentId,
    cardcomAccountId: contact.cardcomAccountId,
    lists_Linked: [...contact.lists],
  }
}

async function changeContactLinkedLists(
  s: SmooveIntegrationServiceData,
  smooveContact: SmooveContact,
  {subscribeTo, unsubscribeFrom}: SmooveContactChangeListsOptions,
): Promise<unknown> {
  const contact = s.state.contacts[smooveContact.id]
  if (!contact) {
    throw new Error(`Contact ${smooveContact.id} not found`)
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

async function updateSmooveContactWithRecurringPayment(
  s: SmooveIntegrationServiceData,
  email: string,
  accountId: string,
  recurringPaymentId: string,
): Promise<'blacklisted' | 'not-exists' | unknown> {
  const contact = Object.values(s.state.contacts).find((c) => c.email === email)

  if (!contact) {
    return 'not-exists'
  }

  if (contact.isBlacklisted) {
    return 'blacklisted'
  }

  // Update the contact
  contact.cardcomAccountId = accountId
  contact.cardcomRecurringPaymentId = recurringPaymentId

  return {success: true}
}

async function fetchLists(s: SmooveIntegrationServiceData) {
  return Object.values(s.state.lists).map((list) => ({
    id: list.id,
    name: list.name,
  }))
}
