import pc from 'picocolors'
import type {ClubServiceData} from './club-service-types.ts'
import {humanIsraeliPhoneNumberToWhatsAppId} from '@giltayar/carmel-tools-whatsapp-integration/utils'
import type {SmooveContactInList} from '@giltayar/carmel-tools-smoove-integration/types'

export async function dealWithUsersWithDebt(s: ClubServiceData) {
  const {
    context: {services},
  } = s
  const logger = services.logger.child({operation: 'deal-with-users-with-debt'})
  const subscribedContacts = await services.smoove.fetchContactsOfList(
    s.context.subscribedSmooveListId,
  )

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

    logger.info({email: smooveContact.email}, 'removing from all courses')
    await services.academy
      .removeContactFromAllCourses(smooveContact.email, s.context.academyCourse)
      .catch((error) => logger.error({err: error, email: smooveContact.email}))

    logger.info({email: smooveContact.email}, 'disabling recurring payments')
    await services.cardcom
      .enableDisableRecurringPayment(smooveContact.cardcomRecurringPaymentId, 'disable')
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

    logger.info({email: smooveContact.email}, 'moving from רשומות to לא שילמו')
    await services.smoove
      .changeContactLinkedLists(smooveContact, {
        unsubscribeFrom: [s.context.subscribedSmooveListId],
        subscribeTo: [s.context.recurringPaymentNotPayedListId],
      })
      .catch((error) => logger.error({err: error, email: smooveContact.email}))
  }
}

async function hasContactPayed(s: ClubServiceData, smooveContact: SmooveContactInList) {
  const badPayments = await s.context.services.cardcom.fetchRecurringPaymentBadPayments(
    smooveContact.cardcomAccountId,
    String(s.context.cardcomProductId),
  )

  if (!badPayments || badPayments.length === 0) {
    return 'no-payments'
  }
  // @ts-expect-error because we know we have at least one bad payment
  return badPayments.at(-1).badPaymentCount == 0 ? 'has-payments' : 'bad-payments'
}
