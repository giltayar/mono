import pc from 'picocolors'
import type {ClubServiceData} from './club-service-types.ts'
import {
  changeContactLinkedLists,
  fetchContactsOfList,
  type SmooveContactInList,
} from '@giltayar/carmel-tools-smoove-integration'
import {removeContactFromAllCourses} from '@giltayar/carmel-tools-academy-integration'
import {
  enableDisableRecurringPayment,
  fetchRecurringPaymentBadPayments,
} from '@giltayar/carmel-tools-cardcom-integration'
import {
  humanIsraeliPhoneNumberToWhatsAppId,
} from '@giltayar/carmel-tools-whatsapp-integration/utils'

export async function dealWithUsersWithDebt(s: ClubServiceData) {
  const {context: {services}} = s
  const subscribedContacts = await fetchContactsOfList(s.context.subscribedSmooveListId)

  let i = 1
  for (const smooveContact of subscribedContacts) {
    process.stdout.write(
      `[${i++}/${subscribedContacts.length}] checking ${smooveContact.email} (${
        smooveContact.cardcomAccountId
      })... `,
    )
    const hasPayed = await hasContactPayed(s, smooveContact)

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
    await removeContactFromAllCourses(smooveContact.email, s.context.academyCourse).catch((error) =>
      console.log(`${smooveContact.email}: ${error.message}`),
    )

    console.log('disabling', smooveContact.email, 'recurring payments')
    await enableDisableRecurringPayment(smooveContact.cardcomRecurringPaymentId, 'disable').catch(
      (error) => console.log(`${smooveContact.email}: ${error.message}`),
    )

    console.log('removing', smooveContact.email, 'from WhatsApp group')
    await services.whatsapp.removeParticipantFromGroup(
      s.context.whatsappGroupId,
      humanIsraeliPhoneNumberToWhatsAppId(smooveContact.telephone),
    ).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))

    console.log('\nmoving', smooveContact.email, 'from רשומות to לא שילמו')
    await changeContactLinkedLists(smooveContact, {
      unsubscribeFrom: [s.context.subscribedSmooveListId],
      subscribeTo: [s.context.recurringPaymentNotPayedListId],
    }).catch((error) => console.log(`${smooveContact.email}: ${error.message}`))
  }
}

async function hasContactPayed(s: ClubServiceData, smooveContact: SmooveContactInList) {
  const badPayments = await fetchRecurringPaymentBadPayments(
    smooveContact.cardcomAccountId,
    String(s.context.cardcomProductId),
  )

  if (!badPayments || badPayments.length === 0) {
    return 'no-payments'
  }
  // @ts-expect-error because we know we have at least one bad payment
  return badPayments.at(-1).badPaymentCount == 0 ? 'has-payments' : 'bad-payments'
}
