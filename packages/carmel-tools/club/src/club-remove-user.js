import { club as HAKOD_HAKVANTI } from '../clubs/hakod-hakvanti.js'
import { removeContactFromAllCourses } from '../common/academy.js'
import { enableDisableRecurringPayment } from '../common/cardcom.js'
import { changeContactLinkedLists, fetchSmooveContact } from '../common/smoove.js'
import {
  humanIsraeliPhoneNumberToWhatsAppId,
  removeParticipantFromGroup,
} from '../common/whatsapp.js'

const email = process.argv[2]

if (!email) {
  throw new Error('Email must be provided as the first argument')
}

const smooveContact = await fetchSmooveContact(email, { by: 'email' })

if (smooveContact.cardcomRecurringPaymentId) {
  console.log(`${smooveContact.email}: deactivating recurring payment in cardcom`)

  await enableDisableRecurringPayment(smooveContact.cardcomRecurringPaymentId, 'disable').catch(
    (error) => console.log(`${smooveContact.email}: ${error.message}`)
  )
}

console.log(`${smooveContact.email}: moving contact from מבטלות to מבוטלות`)
await changeContactLinkedLists(smooveContact, {
  unsubscribeFrom: [HAKOD_HAKVANTI.cancellingSmooveListId],
  subscribeTo: [HAKOD_HAKVANTI.cancelledSmooveListId],
}).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))

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
