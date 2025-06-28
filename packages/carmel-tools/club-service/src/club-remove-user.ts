import type {ClubServiceData} from './club-service-types.ts'
import {humanIsraeliPhoneNumberToWhatsAppId} from '@giltayar/carmel-tools-whatsapp-integration/utils'

export async function removeUser(s: ClubServiceData, email: string) {
  if (!email) {
    throw new Error('Email must be provided as the first argument')
  }

  const {
    context: {services},
  } = s
  const smooveContact = await services.smoove.fetchSmooveContact(email, {by: 'email'})

  if (smooveContact.cardcomRecurringPaymentId) {
    console.log(`${smooveContact.email}: deactivating recurring payment in cardcom`)

    await services.cardcom
      .enableDisableRecurringPayment(smooveContact.cardcomRecurringPaymentId, 'disable')
      .catch((error) => console.log(`${smooveContact.email}: ${error.message}`))
  }

  console.log(`${smooveContact.email}: moving contact from מבטלות to מבוטלות`)
  await services.smoove
    .changeContactLinkedLists(smooveContact, {
      unsubscribeFrom: [s.context.cancellingSmooveListId],
      subscribeTo: [s.context.cancelledSmooveListId],
    })
    .catch((error) => console.log(`${smooveContact.email}: ${error.message}`))

  await services.academy
    .removeContactFromAllCourses(smooveContact.email, s.context.academyCourse)
    .catch((error) => console.log(`${smooveContact.email}: ${error.message}`))

  console.log(
    'removing',
    smooveContact.email,
    'from WhatsApp group',
    '(',
    smooveContact.telephone,
    ')',
  )

  await services.whatsapp
    .removeParticipantFromGroup(
      s.context.whatsappGroupId,
      humanIsraeliPhoneNumberToWhatsAppId(smooveContact.telephone),
    )
    .catch((error) => console.log(`${smooveContact.email}: ${error.message}`))

  console.log('moving', smooveContact.email, 'from מבוטלות to הוסרו')
  await services.smoove
    .changeContactLinkedLists(smooveContact, {
      unsubscribeFrom: [s.context.cancelledSmooveListId],
      subscribeTo: [s.context.unubscribedSmooveListId],
    })
    .catch((error) => console.log(`${smooveContact.email}: ${error.message}`))
}
