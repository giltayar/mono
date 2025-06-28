import type {ClubServiceData} from './club-service-types.ts'

export async function dealWithCancelRequests(s: ClubServiceData) {
  const {
    context: {services},
  } = s
  const contacts = await services.smoove.fetchContactsOfList(s.context.cancellingSmooveListId)

  for (const smooveContact of contacts) {
    if (smooveContact.cardcomRecurringPaymentId) {
      console.log(`${smooveContact.email}: deactivating recurring payment in cardcom`)

      const result = await services.cardcom
        .enableDisableRecurringPayment(smooveContact.cardcomRecurringPaymentId, 'disable')
        .catch((error) => console.log(`${smooveContact.email}: ${error.message}`))

      if (!result) continue
    }

    console.log(`${smooveContact.email}: moving contact from מבטלות to מבוטלות`)
    await services.smoove
      .changeContactLinkedLists(smooveContact, {
        unsubscribeFrom: [s.context.cancellingSmooveListId],
        subscribeTo: [s.context.cancelledSmooveListId],
      })
      .catch((error) => console.log(`${smooveContact.email}: ${error.message}`))
  }
}
