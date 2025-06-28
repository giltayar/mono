import type {WhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'
import type {
  WhatsAppContactId,
  WhatsAppGroupId,
} from '@giltayar/carmel-tools-whatsapp-integration/types'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

type WhatsAppIntegrationServiceData = {
  state: Parameters<typeof createFakeWhatsAppIntegrationService>[0]
}

export function createFakeWhatsAppIntegrationService(context: {
  groups: Record<
    WhatsAppGroupId,
    {
      name: string
      recentSentMessages: string[]
      recentReceivedMessages: string[]
      participants: WhatsAppContactId[]
    }
  >
}) {
  const state: WhatsAppIntegrationServiceData['state'] = {
    groups: structuredClone(context.groups),
  }
  const sBind: ServiceBind<WhatsAppIntegrationServiceData> = (f) => bind(f, {state})

  const service: WhatsAppIntegrationService = {
    fetchWhatsAppGroups: sBind(fetchWhatsAppGroups),
    fetchLastWhatsappGroupsThatWereSentMessage: sBind(fetchLastWhatsappGroupsThatWereSentMessage),
    fetchLastWhatsappGroupsThatWereReceivedMessage: sBind(
      fetchLastWhatsappGroupsThatWereReceivedMessage,
    ),
    removeParticipantFromGroup: sBind(removeParticipantFromGroup),
    addParticipantToGroup: sBind(addParticipantToGroup),
  }

  return {
    ...service,
    _test_listParticipantsInGroup: async (groupId: WhatsAppGroupId) => {
      const group = state.groups[groupId]
      if (!group) throw new Error(`Group ${groupId} not found`)

      return group.participants
    },
  }
}

async function fetchWhatsAppGroups(s: WhatsAppIntegrationServiceData) {
  return Object.entries(s.state.groups).map(([id, group]) => ({
    id: id as WhatsAppGroupId,
    name: group.name,
  }))
}

async function fetchLastWhatsappGroupsThatWereSentMessage(s: WhatsAppIntegrationServiceData) {
  return Object.fromEntries(
    Object.entries(s.state.groups)
      .filter(([, group]) => group.recentSentMessages.length > 0)
      .map(([id, group]) => [
        id,
        group.recentSentMessages.map((m) => ({chatId: id, textMessage: m})),
      ]),
  )
}

async function fetchLastWhatsappGroupsThatWereReceivedMessage(s: WhatsAppIntegrationServiceData) {
  return Object.fromEntries(
    Object.entries(s.state.groups)
      .filter(([, group]) => group.recentReceivedMessages.length > 0)
      .map(([id, group]) => [
        id,
        group.recentReceivedMessages.map((m) => ({chatId: id, textMessage: m})),
      ]),
  )
}

async function removeParticipantFromGroup(
  s: WhatsAppIntegrationServiceData,
  groupId: WhatsAppGroupId,
  participantId: WhatsAppContactId,
) {
  const group = s.state.groups[groupId]
  if (!group) throw new Error(`Group ${groupId} not found`)

  const index = group.participants.indexOf(participantId)
  if (index === -1) throw new Error(`Participant ${participantId} not found in group ${groupId}`)

  group.participants.splice(index, 1)
}

async function addParticipantToGroup(
  s: WhatsAppIntegrationServiceData,
  groupId: WhatsAppGroupId,
  participantId: WhatsAppContactId,
) {
  const group = s.state.groups[groupId]
  if (!group) throw new Error(`Group ${groupId} not found`)

  if (group.participants.includes(participantId)) {
    return
  }

  group.participants.push(participantId)
}
