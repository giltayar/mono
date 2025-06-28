import type {WhatsAppGroupId} from '@giltayar/carmel-tools-whatsapp-integration/types'
import type {WhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'

  export interface ClubServiceContext {
    subscribedSmooveListId: number // מנוי מועדון
    cancellingSmooveListId: number // מבטלות מנוי מועדון
    cancelledSmooveListId: number // מבוטלות מנוי מועדון
    unubscribedSmooveListId: number // הוסרו ממנוי מועדון
    recurringPaymentNotPayedListId: number // תשלומים שלא בוצעו מנוי מועדון
    cardcomProductId: number
    academyCourse: string[]
    whatsappGroupId: WhatsAppGroupId
    services: {
      whatsapp: WhatsAppIntegrationService
    }
  }


export type ClubServiceData = {
  context: ClubServiceContext
}
