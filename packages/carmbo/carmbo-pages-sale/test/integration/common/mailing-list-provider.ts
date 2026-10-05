import type {createFakeSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/testkit'
import type {createFakeRavmesserIntegrationService} from '@giltayar/carmel-tools-ravmesser-integration/testkit'

export const mailingListProviders = ['smoove', 'ravmesser'] as const

export type MailingListProvider = (typeof mailingListProviders)[number]

/** Lists that actually exist in each fake, so name assertions stay meaningful. */
export const mailingListFixtures = {
  smoove: {
    main: {id: 2, name: 'Smoove List ID 1'},
    cancelled: {id: 6, name: 'Smoove List Cancelled 3'},
    removed: {id: 8, name: 'Smoove List Removed 4'},
    secondMain: {id: 10, name: 'Smoove List ID A'},
    thirdMain: {id: 20, name: 'Smoove List ID Alpha'},
  },
  ravmesser: {
    main: {id: 102, name: 'Ravmesser List ID 1'},
    cancelled: {id: 104, name: 'Ravmesser List Cancelled 2'},
    removed: {id: 106, name: 'Ravmesser List Removed 3'},
    secondMain: {id: 110, name: 'Ravmesser List ID A'},
    thirdMain: {id: 120, name: 'Ravmesser List ID Alpha'},
  },
} as const satisfies Record<MailingListProvider, Record<string, {id: number; name: string}>>

export interface MailingListIds {
  listId?: number
  cancelledListId?: number
  removedListId?: number
  removedDateCustomField?: number
}

/** Neither fake validates list ids, so both providers can use the same numbers. */
export function mailingListProductFields(provider: MailingListProvider, lists: MailingListIds) {
  return provider === 'smoove'
    ? {
        mailingListProvider: 'smoove' as const,
        smooveListId: lists.listId,
        smooveCancelledListId: lists.cancelledListId,
        smooveRemovedListId: lists.removedListId,
        smooveRemovedDateCustomField: lists.removedDateCustomField,
      }
    : {
        mailingListProvider: 'ravmesser' as const,
        ravmesserListId: lists.listId,
        ravmesserCancelledListId: lists.cancelledListId,
        ravmesserRemovedListId: lists.removedListId,
        ravmesserRemovedDateCustomField: lists.removedDateCustomField,
      }
}

/** Picks the provider's list card out of a sale-providers product card. */
export function mailingListCard<T>(
  card: {smooveLists: () => T; ravmesserLists: () => T},
  provider: MailingListProvider,
): T {
  return provider === 'smoove' ? card.smooveLists() : card.ravmesserLists()
}

export function mailingListTestkit(
  provider: MailingListProvider,
  {
    smooveIntegration,
    ravmesserIntegration,
  }: {
    smooveIntegration: () => ReturnType<typeof createFakeSmooveIntegrationService>
    ravmesserIntegration: () => ReturnType<typeof createFakeRavmesserIntegrationService>
  },
) {
  const isSmoove = provider === 'smoove'

  const contactsOfList = async (listId: number) =>
    isSmoove
      ? await smooveIntegration().fetchContactsOfList(listId)
      : await ravmesserIntegration().fetchContactsOfList(listId)

  return {
    contactsOfList,

    emailsOfList: async (listId: number) =>
      (await contactsOfList(listId)).map((contact) => contact.email),

    contactByEmail: async (email: string) =>
      isSmoove
        ? await smooveIntegration().fetchSmooveContact(email, {by: 'email'})
        : await ravmesserIntegration().fetchRavmesserContact(email, {by: 'email'}),

    changeContactLinkedLists: async (
      contactId: number,
      lists: {subscribeTo: number[]; unsubscribeFrom: number[]},
    ): Promise<void> => {
      if (isSmoove) {
        await smooveIntegration().changeContactLinkedLists(contactId, lists)
      } else {
        await ravmesserIntegration().changeContactLinkedLists(contactId, lists)
      }
    },

    // Smoove keys custom fields by `i<id>`, RavMesser by the raw numeric id
    removedDateOf: (contactId: number, customFieldId: number) =>
      isSmoove
        ? smooveIntegration()._test_getCustomFields(contactId)?.[`i${customFieldId}`]
        : ravmesserIntegration()._test_getCustomFields(contactId)?.[customFieldId],
  }
}
