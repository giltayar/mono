import type {ClubServiceData} from './club-service-types.ts'
import {humanIsraeliPhoneNumberToWhatsAppId} from '@giltayar/carmel-tools-whatsapp-integration/utils'

export async function removeUser(s: ClubServiceData, email: string) {
  if (!email) {
    throw new Error('Email must be provided as the first argument')
  }

  const {
    context: {services},
  } = s
  const logger = services.logger.child({operation: 'remove-user', email})
  const smooveContact = await services.smoove.fetchSmooveContact(email, {by: 'email'})

  if (smooveContact.cardcomRecurringPaymentId) {
    logger.info('deactivating-recurring-payment-in-cardcom')

    await services.cardcom
      .enableDisableRecurringPayment(smooveContact.cardcomRecurringPaymentId, 'disable')
      .catch((error) => logger.error({err: error, email: smooveContact.email}))
  }

  logger.info('moving-from-cancelling-to-cancelled')
  await services.smoove
    .changeContactLinkedLists(smooveContact, {
      unsubscribeFrom: [s.context.cancellingSmooveListId],
      subscribeTo: [s.context.cancelledSmooveListId],
    })
    .catch((error) => logger.error({err: error, email: smooveContact.email}))

  await services.academy
    .removeContactFromAllCourses(smooveContact.email, s.context.academyCourse)
    .catch((error) => logger.error({err: error, email: smooveContact.email}))

  logger.info(
    {email: smooveContact.email, telephone: smooveContact.telephone},
    'removing-from-whatsapp-group',
  )

  await services.whatsapp
    .removeParticipantFromGroup(
      s.context.whatsappGroupId,
      humanIsraeliPhoneNumberToWhatsAppId(smooveContact.telephone),
    )
    .catch((error) => logger.error({err: error, email: smooveContact.email}))

  logger.info('moving-from-cancelled-to-unsubscribed')
  await services.smoove
    .changeContactLinkedLists(smooveContact, {
      unsubscribeFrom: [s.context.cancelledSmooveListId],
      subscribeTo: [s.context.unubscribedSmooveListId],
    })
    .catch((error) => logger.error({err: error, email: smooveContact.email}))
}
