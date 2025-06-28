import {
  changeContactLinkedLists,
  fetchSmooveContact,
} from '@giltayar/carmel-tools-smoove-integration'
import type {ClubServiceData} from './club-service-types.ts'
import {enableDisableRecurringPayment} from '@giltayar/carmel-tools-cardcom-integration'
import {removeContactFromAllCourses} from '@giltayar/carmel-tools-academy-integration'
import {
  humanIsraeliPhoneNumberToWhatsAppId,
} from '@giltayar/carmel-tools-whatsapp-integration/utils'

export async function removeUser(s: ClubServiceData, email: string) {
  if (!email) {
    throw new Error('Email must be provided as the first argument')
  }

  const {context: {services}} = s
  const smooveContact = await fetchSmooveContact(email, {by: 'email'})

  if (smooveContact.cardcomRecurringPaymentId) {
    console.log(`${smooveContact.email}: deactivating recurring payment in cardcom`)

    await enableDisableRecurringPayment(smooveContact.cardcomRecurringPaymentId, 'disable').catch(
      (error) => console.log(`${smooveContact.email}: ${error.message}`),
    )
  }

  console.log(`${smooveContact.email}: moving contact from מבטלות to מבוטלות`)
  await changeContactLinkedLists(smooveContact, {
    unsubscribeFrom: [s.context.cancellingSmooveListId],
    subscribeTo: [s.context.cancelledSmooveListId],
  }).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))

  await removeContactFromAllCourses(smooveContact.email, s.context.academyCourse).catch((error) =>
    console.log(`${smooveContact.email}: ${error.message}`),
  )

  console.log(
    'removing',
    smooveContact.email,
    'from WhatsApp group',
    '(',
    smooveContact.telephone,
    ')',
  )

  await services.whatsapp.removeParticipantFromGroup(
    s.context.whatsappGroupId,
    humanIsraeliPhoneNumberToWhatsAppId(smooveContact.telephone),
  ).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))

  console.log('moving', smooveContact.email, 'from מבוטלות to הוסרו')
  await changeContactLinkedLists(smooveContact, {
    unsubscribeFrom: [s.context.cancelledSmooveListId],
    subscribeTo: [s.context.unubscribedSmooveListId],
  }).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))
}
