import type {WhatsAppGroupId} from '@giltayar/carmel-tools-whatsapp-integration/types'

export const inspiredLivingDaily = {
  subscribedSmooveListId: 1012986,
  cancellingSmooveListId: 1032013,
  cancelledSmooveListId: 1032114,
  unubscribedSmooveListId: 1034610,
  recurringPaymentNotPayedListId: 1037875,
  cardcomProductId: 16370,
  academyCourse: ['2a99a66fd59bb0b45b74c73fe4ec3169', '2770d99539749c9850a561359e481ca7'],
  whatsappGroupId: '120363389808236299@g.us' as WhatsAppGroupId,
}

export type ClubInformation = typeof inspiredLivingDaily

export const inspiredBusinessDaily: ClubInformation = {
  subscribedSmooveListId: 1055111,
  cancellingSmooveListId: 1055114,
  cancelledSmooveListId: 1055113,
  unubscribedSmooveListId: 1055112,
  recurringPaymentNotPayedListId: NaN, // TBD
  cardcomProductId: NaN, // TBD
  academyCourse: ['9dc2c9bae45f07d65cf8980c13ec2521'],
  whatsappGroupId: '120363400920106353@g.us',
}
