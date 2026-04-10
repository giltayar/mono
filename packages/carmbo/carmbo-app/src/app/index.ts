import process from 'node:process'
import {makeApp} from './carmbo-app.ts'
import * as z from 'zod'
import {createAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import {createWhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'
import {createSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import {throw_, when} from '@giltayar/functional-commons'
import {createCardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import {prepareDatabase} from './prepare-database.ts'
import {initializei18next} from '../commons/i18next-utils.ts'
import {initializeFirebase} from '../domain/auth/model-firebase.ts'
import {createSkoolIntegrationService} from '@giltayar/carmel-tools-skool-integration/service'

export const EnvironmentVariablesSchema = z.object({
  DB_CONNECTION_STRING: z.string().optional(),
  DB_DATABASE: z.string().default('carmbo'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string().default('user'),
  DB_PASSWORD: z.string().default('password'),
  APP_BASE_URL: z.string().optional(),
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(3000),
  ACADEMY_CARMEL_ACCOUNT_API_KEY: z.string().optional(),
  GREEN_API_KEY: z.string(),
  GREEN_API_INSTANCE: z.coerce.number(),
  SMOOVE_API_KEY: z.string().optional(),
  SMOOVE_API_URL: z.url().optional().default('https://rest.smoove.io/v1/'),
  FORCE_NO_AUTH: z.string().optional(),
  CARMBO_FIREBASE_API_KEY: z.string(),
  CARMBO_FIREBASE_SERVICE_ACCOUNT_JSON: z.string(),
  CARMBO_API_SECRET: z.string(),
  CARDCOM_API_KEY: z.string(),
  CARDCOM_API_KEY_PASSWORD: z.string(),
  CARDCOM_TERMINAL_NUMBER: z.coerce.number().default(150067),
  SKOOL_API_UNIQUE_INVITE_LINK_URL: z.url().optional(),
  UI_CONFIGURATION: z.string().optional().default('carmel'),
})

const env = EnvironmentVariablesSchema.parse(
  process.env.NODE_ENV === 'production'
    ? process.env
    : {
        ...process.env,
        SMOOVE_API_KEY:
          process.env.SMOOVE_TEST_API_KEY ?? throw_(new Error('SMOOVE_TEST_API_KEY is not set')),
      },
)

const appBaseUrl = env.APP_BASE_URL
  ? env.APP_BASE_URL
  : `http://${env.HOST.includes(':') ? `[${env.HOST}]` : env.HOST}:${env.PORT}`

if (!env.FORCE_NO_AUTH) {
  initializeFirebase(env.CARMBO_FIREBASE_SERVICE_ACCOUNT_JSON)
}

const {app, sql} = await makeApp({
  db: {
    connectionString: env.DB_CONNECTION_STRING,
    database: env.DB_DATABASE,
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
  },
  services: {
    academyIntegration: when(env.ACADEMY_CARMEL_ACCOUNT_API_KEY, (accountApiKey) =>
      createAcademyIntegrationService({
        accountApiKey,
        accountSubdomain: 'carmel',
      }),
    ),
    whatsappIntegration: createWhatsAppIntegrationService({
      greenApiKey: env.GREEN_API_KEY,
      greenApiInstanceId: env.GREEN_API_INSTANCE,
      greenApiBaseUrl: new URL('https://7105.api.greenapi.com'),
    }),
    smooveIntegration: when(env.SMOOVE_API_KEY, (apiKey) =>
      createSmooveIntegrationService({
        apiKey,
        apiUrl: env.SMOOVE_API_URL,
      }),
    ),
    cardcomIntegration: createCardcomIntegrationService({
      apiKey: env.CARDCOM_API_KEY,
      apiKeyPassword: env.CARDCOM_API_KEY_PASSWORD,
      terminalNumber: env.CARDCOM_TERMINAL_NUMBER.toString(),
    }),
    skoolIntegration: when(env.SKOOL_API_UNIQUE_INVITE_LINK_URL, (skoolApiUniqueInviteLinkUrl) =>
      createSkoolIntegrationService({
        skoolApiUniqueInviteLinkUrl: new URL(skoolApiUniqueInviteLinkUrl),
      }),
    ),
    nowService: () => new Date(),
  },
  firebase: env.FORCE_NO_AUTH
    ? undefined
    : {
        apiKey: env.CARMBO_FIREBASE_API_KEY,
      },
  apiSecret: env.CARMBO_API_SECRET,
  appBaseUrl: appBaseUrl,
  uiConfiguration: env.UI_CONFIGURATION,
})

await prepareDatabase(sql)

await initializei18next(process.env.LANGUAGE)

await app.listen({port: env.PORT, host: env.HOST})
