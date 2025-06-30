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
    if (currentMonth <= smooveContact.signupDate.getMonth() + 1) {
      logger.info({email: smooveContact.email}, 'skipping because they signed up this month')
      continue
    }

    if (emailsNotToRemove.includes(smooveContact.email)) {
      logger.info(
        {email: smooveContact.email},
        'skipping because it is in the emailsNotToRemove list',
      )
      continue
    }

    logger.info({email: smooveContact.email}, 'removing from all courses')

    await services.academy
      .removeContactFromAllCourses(smooveContact.email, s.context.academyCourse)
      .catch((error) => logger.error({err: error, email: smooveContact.email}))

    logger.info(
      {email: smooveContact.email, telephone: smooveContact.telephone},
      'removing from WhatsApp group',
    )

    await services.whatsapp
      .removeParticipantFromGroup(
        s.context.whatsappGroupId,
        humanIsraeliPhoneNumberToWhatsAppId(smooveContact.telephone),
      )
      .catch((error) => logger.error({err: error, email: smooveContact.email}))

    logger.info({email: smooveContact.email}, 'moving from מבוטלות to הוסרו')

    await services.smoove
      .changeContactLinkedLists(smooveContact, {
        unsubscribeFrom: [s.context.cancelledSmooveListId],
        subscribeTo: [s.context.unubscribedSmooveListId],
      })
      .catch((error) => logger.error({err: error, email: smooveContact.email}))
  }
}
