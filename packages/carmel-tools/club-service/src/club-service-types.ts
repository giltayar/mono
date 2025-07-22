import type {WhatsAppGroupId} from '@giltayar/carmel-tools-whatsapp-integration/types'
import type {WhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'
import type {CardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import type {Logger} from 'pino'
import type {GoogleSheetsIntegrationService} from '@giltayar/carmel-tools-google-sheets-integration/service'

export interface ClubServiceContext {
  subscribedSmooveListId: number // מנוי מועדון
  cancellingSmooveListId: number // מבטלות מנוי מועדון
  cancelledSmooveListId: number // מבוטלות מנוי מועדון
  unubscribedSmooveListId: number // הוסרו ממנוי מועדון
  recurringPaymentNotPayedListId: number // תשלומים שלא בוצעו מנוי מועדון
  cardcomProductIds: number[]
  academyCourse: readonly string[]
  whatsappGroupId: WhatsAppGroupId
  dailyMessagesGoogleSheet: URL
  dailyMessagesGoogleSheetTabIndex: number
  services: {
    whatsapp: WhatsAppIntegrationService
    cardcom: CardcomIntegrationService
    smoove: SmooveIntegrationService
    academy: AcademyIntegrationService
    googleSheets: GoogleSheetsIntegrationService
    logger: Logger
  }
}

export type ClubServiceData = {
  context: ClubServiceContext
}
