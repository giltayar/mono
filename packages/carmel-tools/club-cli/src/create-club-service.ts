import {createAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import {createCardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import {createClubService} from '@giltayar/carmel-tools-club-service'
import {createSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import {createWhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'
import type {ClubInformation} from './clubs.ts'
import * as z from 'zod'
import {pino} from 'pino'

const environmentVariablesSchema = z.object({
  GREEN_API_KEY: z.string(),
  CARDCOM_API_KEY: z.string(),
  CARDCOM_API_KEY_PASSWORD: z.string(),
  SMOOVE_API_KEY: z.string(),
})

export function createClubServiceFromClub(club: ClubInformation) {
  const env = environmentVariablesSchema.parse(process.env)

  const whatsappService = createWhatsAppIntegrationService({
    greenApiKey: env.GREEN_API_KEY,
    greenApiInstanceId: 7105239970,
    greenApiBaseUrl: new URL('https://7105.api.greenapi.com'),
  })

  const cardcomService = createCardcomIntegrationService({
    apiKey: env.CARDCOM_API_KEY,
    apiKeyPassword: env.CARDCOM_API_KEY_PASSWORD,
    terminalNumber: '150067',
  })

  const smooveService = createSmooveIntegrationService({
    apiKey: env.SMOOVE_API_KEY,
    apiUrl: 'https://rest.smoove.io',
  })

  const academyService = createAcademyIntegrationService({baseUrl: 'https://www.mypages.co.il'})

  const clubService = createClubService({
    subscribedSmooveListId: club.subscribedSmooveListId,
    cancellingSmooveListId: club.cancellingSmooveListId,
    cancelledSmooveListId: club.cancelledSmooveListId,
    unubscribedSmooveListId: club.unubscribedSmooveListId,
    recurringPaymentNotPayedListId: club.recurringPaymentNotPayedListId,
    cardcomProductId: club.cardcomProductId,
    academyCourse: club.academyCourse,
    whatsappGroupId: club.whatsappGroupId,
    services: {
      whatsapp: whatsappService,
      cardcom: cardcomService,
      smoove: smooveService,
      academy: academyService,
      logger: pino({
        level: process.env.LOG_LEVEL || 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      }),
    },
  })

  return clubService
}
