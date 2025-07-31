import type {ClubServiceData} from './club-service-types.ts'
import {humanIsraeliPhoneNumberToWhatsAppId} from '@giltayar/carmel-tools-whatsapp-integration/utils'

export async function paymentExpiration(s: ClubServiceData) {
  const {
    context: {services},
  } = s
  const logger = services.logger.child({operation: 'payment-expiration'})
  const contactsInCancelledList = await services.smoove.fetchContactsOfList(
    s.context.cancelledSmooveListId,
  )

  const currentMonth = new Date().getMonth() + 1

  const emailsNotToRemove = ['carmelegger1@gmail.com', 'carmelzmoney@gmail.com', 'gil@tayar.org']

  for (const smooveContact of contactsInCancelledList) {
    const subLogger = logger.child({email: smooveContact.email})

    if (currentMonth <= smooveContact.signupDate.getMonth() + 1) {
      subLogger.info('skipping-because-they-signed-up-this-month')
      continue
    }

    if (emailsNotToRemove.includes(smooveContact.email)) {
      subLogger.info('skipping because it is in the emailsNotToRemove list')
      continue
    }

    subLogger.info(
      {
        signupDate: smooveContact.signupDate.toISOString(),
        currentMonth,
      },
      'removing-customer-from-club',
    )
    subLogger.info('removing-from-all-courses')

    await services.academy
      .removeContactFromAllCourses(smooveContact.email, s.context.academyCourse)
      .catch((error) => subLogger.error({err: error}, 'failed-to-remove-from-all-courses'))

    subLogger.info({telephone: smooveContact.telephone}, 'removing-from-whatsapp-group')

    await services.whatsapp
      .removeParticipantFromGroup(
        s.context.whatsappGroupId,
        humanIsraeliPhoneNumberToWhatsAppId(smooveContact.telephone),
      )
      .catch((error) => subLogger.error({err: error}, 'failed-to-remove-from-whatsapp-group'))

    subLogger.info('moving-cancelled-to-unsubscribed')

    await services.smoove
      .changeContactLinkedLists(smooveContact, {
        unsubscribeFrom: [s.context.cancelledSmooveListId],
        subscribeTo: [s.context.unubscribedSmooveListId],
      })
      .catch((error) =>
        subLogger.error({err: error}, 'failed-to-move-contact-to-unsubscribed-list'),
      )
  }
}
