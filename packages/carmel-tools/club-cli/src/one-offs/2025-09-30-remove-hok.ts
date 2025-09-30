import * as clubs from '../clubs/clubs.ts'
import {
  createCardcomIntegrationService,
  createSmooveIntegrationService,
} from '../create-club-service.ts'

for (const club of [clubs.inspiredLivingDaily, clubs.inspiredBusinessDaily]) {
  console.log('Processing club', club.name)
  const smoove = await createSmooveIntegrationService(club)
  const cardcom = await createCardcomIntegrationService()

  const smooveContacts = await smoove.fetchContactsOfList(club.subscribedSmooveListId)

  for (const contact of smooveContacts) {
    if (contact.cardcomRecurringPaymentId) {
      const recurringPaymentId = contact.cardcomRecurringPaymentId
      console.log(`Disabling recurring payment for ${contact.email} (${recurringPaymentId})`)

      await cardcom.enableDisableRecurringPayment(recurringPaymentId, 'disable')
    } else {
      console.log(`No recurring payment for ${contact.email} (${contact.id})`)
    }
  }
  console.log('\n')
}
