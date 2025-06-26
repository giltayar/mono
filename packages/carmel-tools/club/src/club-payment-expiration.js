import { club as HAKOD_HAKVANTI } from '../clubs/hakod-hakvanti.js'
import { removeContactFromAllCourses } from '../common/academy.js'
import { changeContactLinkedLists, fetchContactsOfList } from '../common/smoove.js'
import {
  humanIsraeliPhoneNumberToWhatsAppId,
  removeParticipantFromGroup,
} from '../common/whatsapp.js'

const contactsInCancelledList = await fetchContactsOfList(HAKOD_HAKVANTI.cancelledSmooveListId)

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

  await removeContactFromAllCourses(smooveContact.email, HAKOD_HAKVANTI.academyCourse).catch(
    (error) => console.log(`${smooveContact.email}: ${error.message}`)
  )

  console.log(
    'removing',
    smooveContact.email,
    'from WhatsApp group',
    '(',
    smooveContact.telephone,
    ')'
  )

  await removeParticipantFromGroup(
    HAKOD_HAKVANTI.whatsappGroupId,
    humanIsraeliPhoneNumberToWhatsAppId(smooveContact.telephone)
  ).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))

  console.log('moving', smooveContact.email, 'from מבוטלות to הוסרו')
  await changeContactLinkedLists(smooveContact, {
    unsubscribeFrom: [HAKOD_HAKVANTI.cancelledSmooveListId],
    subscribeTo: [HAKOD_HAKVANTI.unubscribedSmooveListId],
  }).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))
}
