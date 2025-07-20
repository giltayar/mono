import type {ClubServiceData} from './club-service-types.ts'

export async function sendWhatsAppMessage(s: ClubServiceData, message: string) {
  const {
    context: {services, whatsappGroupId},
  } = s
  const logger = services.logger.child({
    operation: 'send-message-to-club',
    groupId: whatsappGroupId,
  })

  logger.info({message: message.slice(0, 10)}, 'sending-message-to-club')

  await services.whatsapp
    .sendMessageToGroup(whatsappGroupId, message)
    .catch((error) => logger.error({err: error}))
}
