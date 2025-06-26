import { club as HAKOD_HAKVANTI } from '../clubs/hakod-hakvanti.js'
import { removeContactFromAllCourses } from '../common/academy.js'
import {
  enableDisableRecurringPayment,
  fetchRecurringPaymentBadPayments,
} from '../common/cardcom.js'
import { changeContactLinkedLists, fetchContactsOfList } from '../common/smoove.js'
import {
  humanIsraeliPhoneNumberToWhatsAppId,
  removeParticipantFromGroup,
} from '../common/whatsapp.js'
import pc from 'picocolors'

const subscribedContacts = (await fetchContactsOfList(HAKOD_HAKVANTI.subscribedSmooveListId))

let i = 1
for (const smooveContact of subscribedContacts) {
  process.stdout.write(
    `[${i++}/${subscribedContacts.length}] checking ${smooveContact.email} (${
      smooveContact.cardcomAccountId
    })... `
  )
  const hasPayed = await hasContactPayed(smooveContact)

  switch (hasPayed) {
    case 'no-payments':
      console.log(pc.yellow('no payments'))
      continue
    case 'has-payments':
      console.log('has payments')
      continue
    case 'bad-payments':
      console.log(pc.red('bad payments'))
      break
  }

  console.log('removing', smooveContact.email, 'from all courses')
  await removeContactFromAllCourses(smooveContact.email, HAKOD_HAKVANTI.academyCourse).catch(
    (error) => console.log(`${smooveContact.email}: ${error.message}`)
  )

  console.log('disabling', smooveContact.email, 'recurring payments')
  await enableDisableRecurringPayment(smooveContact.cardcomRecurringPaymentId, 'disable').catch(
    (error) => console.log(`${smooveContact.email}: ${error.message}`)
  )

  console.log('removing', smooveContact.email, 'from WhatsApp group')
  await removeParticipantFromGroup(
    HAKOD_HAKVANTI.whatsappGroupId,
    humanIsraeliPhoneNumberToWhatsAppId(smooveContact.telephone)
  ).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))

  console.log('\nmoving', smooveContact.email, 'from רשומות to לא שילמו')
  await changeContactLinkedLists(smooveContact, {
    subscribeTo: [HAKOD_HAKVANTI.recurringPaymentNotPayedListId],
    unsubscribeFrom: [HAKOD_HAKVANTI.subscribedSmooveListId],
  }).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))
}

/**
 * @param {import("../common/smoove.js").SmooveContactInList} smooveContact
 * @returns {Promise<'no-payments' | 'has-payments' | 'bad-payments'>}
 */
async function hasContactPayed(smooveContact) {
  const badPayments = await fetchRecurringPaymentBadPayments(
    smooveContact.cardcomAccountId,
    String(HAKOD_HAKVANTI.cardcomProductId)
  )

  if (!badPayments || badPayments.length === 0) {
    return 'no-payments'
  }
  // @ts-expect-error
  return badPayments.at(-1).badPaymentCount == 0 ? 'has-payments' : 'bad-payments'
}
