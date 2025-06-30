import type {WhatsAppGroupId} from '@giltayar/carmel-tools-whatsapp-integration/types'
import type {WhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'
import type {CardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import type {Logger} from 'pino'

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
    cardcom: CardcomIntegrationService
    smoove: SmooveIntegrationService
    academy: AcademyIntegrationService
    logger: Logger
  }
}

export type ClubServiceData = {
  context: ClubServiceContext
}
