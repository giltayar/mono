import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import type {
  WhatsAppGroupId,
  WhatsAppContactId,
} from '@giltayar/carmel-tools-whatsapp-integration/types'

export interface WhatsAppIntegrationServiceContext {
  greenApiKey: string
  greenApiInstanceId: number
  greenApiBaseUrl: URL
}

type WhatsAppIntegrationServiceData = {
  context: WhatsAppIntegrationServiceContext
}

export function createWhatsAppIntegrationService(context: WhatsAppIntegrationServiceContext) {
  const sBind: ServiceBind<WhatsAppIntegrationServiceData> = (f) => bind(f, {context})

  return {
    fetchWhatsAppGroups: sBind(fetchWhatsAppGroups),
    removeParticipantFromGroup: sBind(removeParticipantFromGroup),
    addParticipantToGroup: sBind(addParticipantToGroup),
    fetchLastWhatsappGroupsThatWereSentMessage: sBind(fetchLastWhatsappGroupsThatWereSentMessage),
    fetchLastWhatsappGroupsThatWereReceivedMessage: sBind(
      fetchLastWhatsappGroupsThatWereReceivedMessage,
    ),
    sendMessageToGroup: sBind(sendMessageToGroup),
    listParticipantsInGroup: sBind(listParticipantsInGroup),
  }
}

export type WhatsAppIntegrationService = ReturnType<typeof createWhatsAppIntegrationService>

export async function fetchWhatsAppGroups(
  s: WhatsAppIntegrationServiceData,
): Promise<{id: WhatsAppGroupId; name: string}[]> {
  const url = createApiUrl(s, 'getContacts')
  url.searchParams.append('group', 'true')

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${await response.text()}`)
  }

  const data = (await response.json()) as {id: WhatsAppGroupId; name: string}[]
  return data.map((contact) => ({
    id: contact.id,
    name: contact.name,
  }))
}

export async function removeParticipantFromGroup(
  s: WhatsAppIntegrationServiceData,
  groupId: WhatsAppGroupId,
  participantId: WhatsAppContactId,
) {
  const url = createApiUrl(s, 'removeGroupParticipant')

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      groupId,
      participantChatId: participantId,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to remove participant: ${response.status} ${await response.text()}`)
  }

  await response.json()
}

export async function addParticipantToGroup(
  s: WhatsAppIntegrationServiceData,
  groupId: WhatsAppGroupId,
  participantId: WhatsAppContactId,
) {
  const url = createApiUrl(s, 'addGroupParticipant')

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      groupId,
      participantChatId: participantId,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to add participant: ${response.status} ${await response.text()}`)
  }

  await response.json()
}

export interface WhatsAppMessage {
  chatId: string
  textMessage: string
}

/**
 * Fetches the last WhatsApp groups that were sent a message
 * @returns A grouped object of messages by chat ID
 */
export async function fetchLastWhatsappGroupsThatWereSentMessage(
  s: WhatsAppIntegrationServiceData,
): Promise<Record<string, WhatsAppMessage[]>> {
  const url = createApiUrl(s, 'lastOutgoingMessages')

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch last whatsapp groups: ${response.status} ${await response.text()}`,
    )
  }

  const data = (await response.json()) as GreenApiMessage[]

  return Object.groupBy(
    data
      .filter((d) => d.typeMessage === 'textMessage')
      .map((d) => ({chatId: d.chatId, textMessage: d.textMessage})),
    (d) => d.chatId,
  )
}

/**
 * Fetches the last WhatsApp groups that received a message
 * @returns A grouped object of messages by chat ID
 */
export async function fetchLastWhatsappGroupsThatWereReceivedMessage(
  s: WhatsAppIntegrationServiceData,
): Promise<Record<string, WhatsAppMessage[]>> {
  const url = createApiUrl(s, 'lastIncomingMessages')

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch last whatsapp groups: ${response.status} ${await response.text()}`,
    )
  }

  const data = (await response.json()) as GreenApiMessage[]

  return Object.groupBy(
    data
      .filter((d) => d.typeMessage === 'textMessage')
      .map((d) => ({chatId: d.chatId, textMessage: d.textMessage})),
    (d) => d.chatId,
  )
}

export async function listParticipantsInGroup(
  s: WhatsAppIntegrationServiceData,
  groupId: WhatsAppGroupId,
): Promise<WhatsAppContactId[]> {
  const url = createApiUrl(s, 'getGroupData')

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({groupId}),
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch last whatsapp groups: ${response.status} ${await response.text()}`,
    )
  }

  const data = (await response.json()) as any

  return data.participants.map((participant: any) => participant.id as WhatsAppContactId)
}

function createApiUrl(s: WhatsAppIntegrationServiceData, endpoint: string): URL {
  return new URL(
    `/waInstance${s.context.greenApiInstanceId}/${endpoint}/${s.context.greenApiKey}`,
    s.context.greenApiBaseUrl,
  )
}

async function sendMessageToGroup(
  s: WhatsAppIntegrationServiceData,
  groupId: WhatsAppGroupId,
  message: string,
): Promise<void> {
  const url = createApiUrl(s, 'sendMessage')

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      chatId: groupId,
      message,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.status} ${await response.text()}`)
  }

  await response.json()
}

interface GreenApiMessage {
  typeMessage: string
  chatId: string
  textMessage: string
}
