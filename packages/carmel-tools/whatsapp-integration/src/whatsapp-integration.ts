import {throw_} from '@giltayar/functional-commons'

const GREEN_API_KEY = process.env.GREEN_API_KEY ?? throw_(new Error('GREEN_API_KEY is not set'))
const GREEN_API_INSTANCE_ID = 7105239970
const GREEN_API_BASE_URL = `https://7105.api.greenapi.com/waInstance${GREEN_API_INSTANCE_ID}/getContacts/${GREEN_API_KEY}`

export type WhatsAppContactId = `972${string}@c.us`
export type WhatsAppGroupId = `${string}@g.us`

export interface WhatsAppContact {
  id: WhatsAppContactId | WhatsAppGroupId
  name: string
}

/**
 * Fetches WhatsApp groups from the Green API
 * @returns Promise with an array of WhatsApp groups
 */
export async function fetchWhatsAppGroups(): Promise<{id: WhatsAppGroupId; name: string}[]> {
  const url = new URL(GREEN_API_BASE_URL)
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

/**
 * Converts a human-readable Israeli phone number to a WhatsApp contact ID
 * @param phoneNumber The phone number to convert
 * @returns WhatsApp contact ID
 */
export function humanIsraeliPhoneNumberToWhatsAppId(phoneNumber: string): WhatsAppContactId {
  phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

  if (phoneNumber.startsWith('0')) {
    phoneNumber = '972' + phoneNumber.slice(1)
  } else if (!phoneNumber.startsWith('972')) {
    phoneNumber = '972' + phoneNumber
  }

  if (phoneNumber.charAt(3) === '0') {
    phoneNumber = phoneNumber.slice(0, 3) + phoneNumber.slice(4)
  }
  return `${phoneNumber}@c.us` as WhatsAppContactId
}

/**
 * Removes a participant from a WhatsApp group
 * @param groupId The ID of the group
 * @param participantId The ID of the participant to remove
 * @returns The API response
 */
export async function removeParticipantFromGroup(
  groupId: WhatsAppGroupId,
  participantId: WhatsAppContactId,
): Promise<any> {
  const url = new URL(
    `https://7105.api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/removeGroupParticipant/${GREEN_API_KEY}`,
  )

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

  return await response.json()
}

/**
 * Adds a participant to a WhatsApp group
 * @param groupId The ID of the group
 * @param participantId The ID of the participant to add
 * @returns The API response
 */
export async function addParticipantToGroup(
  groupId: WhatsAppGroupId,
  participantId: WhatsAppContactId,
): Promise<any> {
  const url = new URL(
    `https://7105.api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/addGroupParticipant/${GREEN_API_KEY}`,
  )

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

  return await response.json()
}

interface WhatsAppMessage {
  chatId: string
  textMessage: string
}

/**
 * Fetches the last WhatsApp groups that were sent a message
 * @returns A grouped object of messages by chat ID
 */
export async function fetchLastWhatsappGroupsThatWereSentMessage(): Promise<
  Record<string, WhatsAppMessage[]>
> {
  const url = new URL(
    `https://7105.api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/lastOutgoingMessages/${GREEN_API_KEY}`,
  )

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch last whatsapp groups: ${response.status} ${await response.text()}`,
    )
  }

  const data = (await response.json()) as any[]

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
export async function fetchLastWhatsappGroupsThatWereReceivedMessage(): Promise<
  Record<string, WhatsAppMessage[]>
> {
  const url = new URL(
    `https://7105.api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/lastIncomingMessages/${GREEN_API_KEY}`,
  )

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch last whatsapp groups: ${response.status} ${await response.text()}`,
    )
  }

  const data = (await response.json()) as any[]

  return Object.groupBy(
    data
      .filter((d) => d.typeMessage === 'textMessage')
      .map((d) => ({chatId: d.chatId, textMessage: d.textMessage})),
    (d) => d.chatId,
  )
}
