import { club as HAKOD_HAKVANTI } from '../clubs/hakod-hakvanti.js'
import { enableDisableRecurringPayment } from '../common/cardcom.js'
import { fetchContactsOfList, changeContactLinkedLists } from '../common/smoove.js'

const contacts = await fetchContactsOfList(HAKOD_HAKVANTI.cancellingSmooveListId)

for (const smooveContact of contacts) {
  if (smooveContact.cardcomRecurringPaymentId) {
    console.log(`${smooveContact.email}: deactivating recurring payment in cardcom`)

    const result = await enableDisableRecurringPayment(
      smooveContact.cardcomRecurringPaymentId,
      'disable'
    ).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))

    if (!result) continue
  }

  console.log(`${smooveContact.email}: moving contact from מבטלות to מבוטלות`)
  await changeContactLinkedLists(smooveContact, {
    unsubscribeFrom: [HAKOD_HAKVANTI.cancellingSmooveListId],
    subscribeTo: [HAKOD_HAKVANTI.cancelledSmooveListId],
  }).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))
}
