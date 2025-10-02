import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import type {
  WhatsAppGroupId,
  WhatsAppContactId,
} from '@giltayar/carmel-tools-whatsapp-integration/types'
import {fetchAsBuffer, fetchAsJson, fetchAsJsonWithJsonBody} from '@giltayar/http-commons'
import mime from 'mime/lite'

export interface WhatsAppIntegrationServiceContext {
  greenApiKey: string
  greenApiInstanceId: number
  greenApiBaseUrl: URL
}

export type WhatsAppMessage = {} & (
  | {
      timestamp: Date
      messageId: string
      textMessage: string
    }
  | {
      timestamp: Date
      messageId: string
      mediaUrl: string
      caption: string
      filename: string
    }
  | {
      timestamp: Date
      messageId: string
    }
)

type WhatsAppIntegrationServiceData = {
  context: WhatsAppIntegrationServiceContext
}

export function createWhatsAppIntegrationService(context: WhatsAppIntegrationServiceContext) {
  const sBind: ServiceBind<WhatsAppIntegrationServiceData> = (f) => bind(f, {context})

  return {
    fetchWhatsAppGroups: sBind(fetchWhatsAppGroups),
    removeParticipantFromGroup: sBind(removeParticipantFromGroup),
    addParticipantToGroup: sBind(addParticipantToGroup),
    sendMessageToGroup: sBind(sendMessageToGroup),
    listParticipantsInGroup: sBind(listParticipantsInGroup),
    fetchLatestMessagesFromGroup: sBind(fetchLatestMessagesFromGroup),
  }
}

export type WhatsAppIntegrationService = ReturnType<typeof createWhatsAppIntegrationService>

export type WhatsAppGroup = {
  id: WhatsAppGroupId
  name: string
}

async function fetchWhatsAppGroups(s: WhatsAppIntegrationServiceData): Promise<WhatsAppGroup[]> {
  const url = createApiUrl(s, 'getContacts')
  url.searchParams.append('group', 'true')

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${await response.text()}`)
  }

  const data = (await response.json()) as WhatsAppGroup[]
  return data.map((contact) => ({
    id: contact.id,
    name: contact.name,
  }))
}

async function removeParticipantFromGroup(
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

async function addParticipantToGroup(
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

async function listParticipantsInGroup(
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
  {mediaUrl}: {mediaUrl: string | undefined} = {mediaUrl: undefined},
): Promise<void> {
  if (!mediaUrl) {
    await fetchAsJsonWithJsonBody(createApiUrl(s, 'sendMessage'), {
      chatId: groupId,
      message,
    })
  } else {
    const media = await fetchAsBuffer(mediaUrl)
    const fileExtension = mediaUrl.split('.').at(-1) ?? 'mp4'

    // upload file if it wasn't already loaded to Green API servers
    const {urlFile} = mediaUrl.includes(`/${s.context.greenApiInstanceId}/`)
      ? {urlFile: mediaUrl}
      : ((await fetchAsJson(createApiUrl(s, 'uploadFile'), {
          method: 'POST',
          headers: {'Content-Type': mime.getType(fileExtension) ?? 'application/octet-stream'},
          body: media,
        })) as {urlFile: string})

    await fetchAsJsonWithJsonBody(createApiUrl(s, 'sendFileByUrl'), {
      chatId: groupId,
      urlFile,
      fileName: 'file.' + fileExtension,
      caption: message,
    })
  }
}

async function fetchLatestMessagesFromGroup(
  s: WhatsAppIntegrationServiceData,
  groupId: WhatsAppGroupId,
  count: number,
): Promise<WhatsAppMessage[]> {
  const url = createApiUrl(s, 'getChatHistory')

  const response = (await fetchAsJsonWithJsonBody(url, {
    chatId: groupId,
    count,
  })) as GreenApiMessage[]

  return response.map(greenApiMessageToWhatsAppMessage)
}

interface GreenApiMessage {
  timestamp: number
  idMessage: string
  textMessage?: string
  downloadUrl?: string
  caption?: string
  fileName?: string
}

function greenApiMessageToWhatsAppMessage(msg: GreenApiMessage): WhatsAppMessage {
  if (msg.textMessage !== undefined) {
    return {
      messageId: msg.idMessage,
      textMessage: msg.textMessage,
      timestamp: new Date(msg.timestamp * 1000),
    }
  } else if (msg.downloadUrl !== undefined) {
    return {
      messageId: msg.idMessage,
      mediaUrl: msg.downloadUrl,
      caption: msg.caption ?? '',
      filename: msg.fileName ?? 'unknown',
      timestamp: new Date(msg.timestamp * 1000),
    }
  } else {
    return {messageId: msg.idMessage, timestamp: new Date(msg.timestamp * 1000)}
  }
}
