import type {
  WhatsAppGroup,
  WhatsAppIntegrationService,
} from '@giltayar/carmel-tools-whatsapp-integration/service'

const cachedWhatsAppGroups: {
  groups: WhatsAppGroup[] | undefined
  timestamp: number
} = {
  groups: undefined,
  timestamp: 0,
}

export async function listWhatsAppGroups(
  whatsappIntegration: WhatsAppIntegrationService,
  now: Date,
) {
  if (
    now.getTime() - cachedWhatsAppGroups.timestamp > 1 * 60 * 1000 ||
    !cachedWhatsAppGroups.groups
  ) {
    cachedWhatsAppGroups.groups = await whatsappIntegration.fetchWhatsAppGroups()
    cachedWhatsAppGroups.timestamp = now.getTime()
  }

  return cachedWhatsAppGroups.groups
}
