export type WhatsAppContactId = `972${string}@c.us`
export type WhatsAppGroupId = `${string}@g.us`

export interface WhatsAppContact {
  id: WhatsAppContactId | WhatsAppGroupId
  name: string
}
