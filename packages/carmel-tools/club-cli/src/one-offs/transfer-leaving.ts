import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {WhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'
import {humanIsraeliPhoneNumberToWhatsAppId} from '@giltayar/carmel-tools-whatsapp-integration/utils'
import {exponential, type ClubInformation} from '../clubs/clubs.ts'

const smooveClubId = 931893
const smooveContinuingId = 1060451
const smooveLeavingId = 1006396

// if she is in the club, and is not in the continuing group, then she is leaving

export async function transferFromClubToLeaving(smoove: SmooveIntegrationService) {
  const membersInClub = await smoove.fetchContactsOfList(smooveClubId)

  const membersInContinuing = (await smoove.fetchContactsOfList(smooveContinuingId)).map(
    (member) => member.email,
  )
  const membersToTransfer = membersInClub.filter(
    (member) => !membersInContinuing.includes(member.email),
  )

  for (const member of membersToTransfer) {
    console.log(`Transferring ${member.email} from club to leaving group`)
    await smoove.changeContactLinkedLists(member, {
      unsubscribeFrom: [smooveClubId],
      subscribeTo: [smooveLeavingId],
    })
  }
}

export async function removeLeavingFromWhatsappGroup(
  smoove: SmooveIntegrationService,
  whatsapp: WhatsAppIntegrationService,
) {
  const membersInLeaving = await smoove.fetchContactsOfList(smooveLeavingId)

  for (const member of membersInLeaving) {
    console.log(`Removing ${member.email} from WhatsApp group`)

    await whatsapp.removeParticipantFromGroup(
      exponential.whatsappGroupId!,
      humanIsraeliPhoneNumberToWhatsAppId(member.telephone),
    )
  }
}

export async function syncWhatsappGroupWithClub(
  smoove: SmooveIntegrationService,
  whatsapp: WhatsAppIntegrationService,
  club: ClubInformation,
) {
  const membersInClub = await smoove.fetchContactsOfList(club.subscribedSmooveListId)
  const membersPhoneNumbers = new Set(
    membersInClub.map((member) => humanIsraeliPhoneNumberToWhatsAppId(member.telephone)),
  )

  const rawList = await whatsapp.listParticipantsInGroup(club.whatsappGroupId!)

  const listOfPhoneNumbers = new Set(rawList)

  for (const member of listOfPhoneNumbers) {
    if (membersPhoneNumbers.has(member)) {
      console.log(`Huh?`, member, `is in the WhatsApp group but not in the club`)
    }
  }
}
