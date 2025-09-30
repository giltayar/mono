import type {WhatsAppGroupId} from '@giltayar/carmel-tools-whatsapp-integration/types'

export const inspiredLivingDaily = {
  name: 'Inspired Living Daily',
  subscribedSmooveListId: 1012986,
  cancellingSmooveListId: 1032013,
  cancelledSmooveListId: 1032114,
  unubscribedSmooveListId: 1034610,
  continuingSmooveListId: 0,
  recurringPaymentNotPayedListId: 1037875,
  cardcomProductId: [16370, 16547],
  smooveFieldForCardComRecurringPaymentId: 'i12',
  smooveFieldForCardComAcountId: 'i13',
  academyCourse: ['2a99a66fd59bb0b45b74c73fe4ec3169', '2770d99539749c9850a561359e481ca7'],
  whatsappGroupId: '120363389808236299@g.us' as WhatsAppGroupId,
  dailyMessagesGoogleSheet:
    'https://docs.google.com/spreadsheets/d/1eShTuk7F_Ckc6SFvGyolgVSyAZREE1KICJtKJGXXyBc/edit?gid=1341595384#gid=1341595384',
  dailyMessagesGoogleSheetTabIndex: 0,
}

export type ClubInformation = typeof inspiredLivingDaily

export const inspiredBusinessDaily: ClubInformation = {
  name: 'Inspired Business Daily',
  subscribedSmooveListId: 1055111,
  cancellingSmooveListId: 1055114,
  cancelledSmooveListId: 1055113,
  unubscribedSmooveListId: 1055112,
  continuingSmooveListId: 0,
  recurringPaymentNotPayedListId: 1055135, // TBD
  cardcomProductId: [16810],
  smooveFieldForCardComRecurringPaymentId: 'i16',
  smooveFieldForCardComAcountId: 'i17',
  academyCourse: ['9dc2c9bae45f07d65cf8980c13ec2521'],
  whatsappGroupId: '120363400920106353@g.us',
  dailyMessagesGoogleSheet:
    'https://docs.google.com/spreadsheets/d/1eShTuk7F_Ckc6SFvGyolgVSyAZREE1KICJtKJGXXyBc/edit?gid=1341595384#gid=1341595384',
  dailyMessagesGoogleSheetTabIndex: 1,
}

//@ts-expect-error this is a partial club. Not yet ready for production
export const exponential: ClubInformation = {
  subscribedSmooveListId: 931893,
  unubscribedSmooveListId: 1006396,
  continuingSmooveListId: 1060451,
  whatsappGroupId: '120363298297503251@g.us',
} as Partial<ClubInformation>

//@ts-expect-error this is a partial club. For testing.
export const forTesting: ClubInformation = {
  whatsappGroupId: '120363403406458434@g.us',
  dailyMessagesGoogleSheet:
    'https://docs.google.com/spreadsheets/d/1eShTuk7F_Ckc6SFvGyolgVSyAZREE1KICJtKJGXXyBc/edit?gid=1341595384#gid=1341595384',
  dailyMessagesGoogleSheetTabIndex: 5,
} as Partial<ClubInformation>
