import {createAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import {createCardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import {createClubService} from '@giltayar/carmel-tools-club-service'
import {createSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import {createWhatsAppIntegrationService as createWhatsAppIntegrationService_} from '@giltayar/carmel-tools-whatsapp-integration/service'
import type {ClubInformation} from './clubs/clubs.ts'
import * as z from 'zod'
import {pino} from 'pino'
import {createGoogleSheetsIntegrationService} from '@giltayar/carmel-tools-google-sheets-integration/service'

export function createWhatsAppIntegrationService() {
  const env = loadEnvironmentVariables()

  return createWhatsAppIntegrationService_({
    greenApiKey: env.GREEN_API_KEY,
    greenApiInstanceId: env.GREEN_API_INSTANCE,
    greenApiBaseUrl: new URL('https://7105.api.greenapi.com'),
  })
}

export async function createClubServiceFromClub(club: ClubInformation, logger: pino.Logger) {
  const env = loadEnvironmentVariables()

  const whatsappService = createWhatsAppIntegrationService()

  const cardcomService = createCardcomIntegrationService({
    apiKey: env.CARDCOM_API_KEY,
    apiKeyPassword: env.CARDCOM_API_KEY_PASSWORD,
    terminalNumber: '150067',
  })

  const smooveService = createSmooveIntegrationService({
    apiKey: env.SMOOVE_API_KEY,
    apiUrl: 'https://rest.smoove.io/v1/',
    cardComRecurringPaymentIdCustomFieldId: club.smooveFieldForCardComRecurringPaymentId,
    cardComAccountIdCustomFieldId: club.smooveFieldForCardComAcountId,
  })

  const googleSheetsService = await createGoogleSheetsIntegrationService({
    privateKeyJson: env.GOOGLE_SHEETS_API_KEY,
  })

  const academyService = createAcademyIntegrationService({baseUrl: 'https://www.mypages.co.il'})

  const clubService = createClubService({
    subscribedSmooveListId: club.subscribedSmooveListId,
    cancellingSmooveListId: club.cancellingSmooveListId,
    cancelledSmooveListId: club.cancelledSmooveListId,
    unubscribedSmooveListId: club.unubscribedSmooveListId,
    recurringPaymentNotPayedListId: club.recurringPaymentNotPayedListId,
    cardcomProductIds: club.cardcomProductId,
    academyCourse: club.academyCourse,
    whatsappGroupId: club.whatsappGroupId,
    dailyMessagesGoogleSheet: new URL(club.dailyMessagesGoogleSheet),
    dailyMessagesGoogleSheetTabIndex: club.dailyMessagesGoogleSheetTabIndex,
    services: {
      whatsapp: whatsappService,
      cardcom: cardcomService,
      smoove: smooveService,
      academy: academyService,
      googleSheets: googleSheetsService,
      logger,
    },
  })

  return clubService
}

function loadEnvironmentVariables() {
  const environmentVariablesSchema = z.object({
    GREEN_API_KEY: z.string(),
    GREEN_API_INSTANCE: z.string().transform((val) => parseInt(val, 10)),
    CARDCOM_API_KEY: z.string(),
    CARDCOM_API_KEY_PASSWORD: z.string(),
    GOOGLE_SHEETS_API_KEY: z.string(),
    SMOOVE_API_KEY: z.string(),
  })

  return environmentVariablesSchema.parse(process.env)
}
