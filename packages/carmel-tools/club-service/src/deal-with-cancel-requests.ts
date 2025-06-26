import {
  changeContactLinkedLists,
  fetchContactsOfList,
} from '@giltayar/carmel-tools-smoove-integration'
import type {ClubServiceData} from './club-service-types.ts'
import {enableDisableRecurringPayment} from '@giltayar/carmel-tools-cardcom-integration'

export async function dealWithCancelRequests(s: ClubServiceData) {
  const contacts = await fetchContactsOfList(s.context.cancellingSmooveListId)

  for (const smooveContact of contacts) {
    if (smooveContact.cardcomRecurringPaymentId) {
      console.log(`${smooveContact.email}: deactivating recurring payment in cardcom`)

      const result = await enableDisableRecurringPayment(
        smooveContact.cardcomRecurringPaymentId,
        'disable',
      ).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))

      if (!result) continue
    }

    console.log(`${smooveContact.email}: moving contact from מבטלות to מבוטלות`)
    await changeContactLinkedLists(smooveContact, {
      unsubscribeFrom: [s.context.cancellingSmooveListId],
      subscribeTo: [s.context.cancelledSmooveListId],
    }).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))
  }
}
