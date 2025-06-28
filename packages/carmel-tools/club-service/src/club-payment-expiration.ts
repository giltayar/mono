import {
  changeContactLinkedLists,
  fetchContactsOfList,
} from '@giltayar/carmel-tools-smoove-integration'
import type {ClubServiceData} from './club-service-types.ts'
import {removeContactFromAllCourses} from '@giltayar/carmel-tools-academy-integration'
import {
  humanIsraeliPhoneNumberToWhatsAppId,
} from '@giltayar/carmel-tools-whatsapp-integration/utils'

export async function paymentExpiration(s: ClubServiceData) {
  const {context: {services}} = s
  const contactsInCancelledList = await fetchContactsOfList(s.context.cancelledSmooveListId)

  const currentMonth = new Date().getMonth() + 1

  const emailsNotToRemove = ['carmelegger1@gmail.com', 'carmelzmoney@gmail.com', 'gil@tayar.org']

  for (const smooveContact of contactsInCancelledList) {
    if (currentMonth <= smooveContact.signupDate.getMonth() + 1) {
      console.log('skipping', smooveContact.email, 'because they signed up this month')
      continue
    }

    if (emailsNotToRemove.includes(smooveContact.email)) {
      console.log('skipping', smooveContact.email, 'because it is in the emailsNotToRemove list')
      continue
    }

    console.log('removing', smooveContact.email, 'from all courses')

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
}
