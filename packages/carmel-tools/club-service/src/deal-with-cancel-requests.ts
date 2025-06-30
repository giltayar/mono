import type {ClubServiceData} from './club-service-types.ts'

export async function dealWithCancelRequests(s: ClubServiceData) {
  const {
    context: {services},
  } = s
  const logger = services.logger.child({operation: 'deal-with-cancel-requests'})
  const contacts = await services.smoove.fetchContactsOfList(s.context.cancellingSmooveListId)

  for (const smooveContact of contacts) {
    if (smooveContact.cardcomRecurringPaymentId) {
      logger.info({email: smooveContact.email}, 'deactivating recurring payment in cardcom')

      const result = await services.cardcom
        .enableDisableRecurringPayment(smooveContact.cardcomRecurringPaymentId, 'disable')
        .catch((error) => logger.error({err: error, email: smooveContact.email}))

      if (!result) continue
    }

    logger.info({email: smooveContact.email}, 'moving contact from מבטלות to מבוטלות')
    await services.smoove
      .changeContactLinkedLists(smooveContact, {
        unsubscribeFrom: [s.context.cancellingSmooveListId],
        subscribeTo: [s.context.cancelledSmooveListId],
      })
      .catch((error) => logger.error({err: error, email: smooveContact.email}))
  }
}
