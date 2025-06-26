import type {WhatsAppGroupId} from '@giltayar/carmel-tools-whatsapp-integration'

export namespace ClubService {
  export interface Context {
    subscribedSmooveListId: number // מנוי מועדון
    cancellingSmooveListId: number // מבטלות מנוי מועדון
    cancelledSmooveListId: number // מבוטלות מנוי מועדון
    unubscribedSmooveListId: number // הוסרו ממנוי מועדון
    recurringPaymentNotPayedListId: number // תשלומים שלא בוצעו מנוי מועדון
    cardcomProductId: number
    academyCourse: string[]
    whatsappGroupId: WhatsAppGroupId
  }
}

export type ClubServiceData = {
  context: ClubService.Context
}
