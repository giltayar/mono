import type {WhatsAppGroupId} from '@giltayar/carmel-tools-whatsapp-integration/types'

export const hakavodHakvanti = {
  subscribedSmooveListId: 1012986, // מנוי הקוד הקוונטי כסף
  cancellingSmooveListId: 1032013, // מבטלות מנוי הקוד הקוונטי כסף
  cancelledSmooveListId: 1032114, // מבוטלות מנוי הקוד הקוונטי כסף
  unubscribedSmooveListId: 1034610, // הוסרו ממנוי הקוד הקוונטי כסף
  recurringPaymentNotPayedListId: 1037875, // תשלומים שלא בוצעו מנוי הקוד הקוונטי כסף
  cardcomProductId: 16370,
  academyCourse: ['2a99a66fd59bb0b45b74c73fe4ec3169', '2770d99539749c9850a561359e481ca7'] as const,
  whatsappGroupId: '120363389808236299@g.us' as WhatsAppGroupId,
} as const

export type ClubInformation = typeof hakavodHakvanti
