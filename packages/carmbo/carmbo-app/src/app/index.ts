import process from 'node:process'
import {makeApp} from './carmbo-app.ts'
import * as z from 'zod'
import {createAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import {createWhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'
import {createSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import {throw_} from '@giltayar/functional-commons'
import {createCardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import {prepareDatabase} from './prepare-database.ts'

export const EnvironmentVariablesSchema = z.object({
  DB_DATABASE: z.string().default('carmbo'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string().default('user'),
  DB_PASSWORD: z.string().default('password'),
  APP_BASE_URL: z.string().optional(),
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(3000),
  ACADEMY_CARMEL_ACCOUNT_API_KEY: z.string(),
  GREEN_API_KEY: z.string(),
  GREEN_API_INSTANCE: z.coerce.number(),
  SMOOVE_API_KEY: z.string(),
  SMOOVE_API_URL: z.url().optional().default('https://rest.smoove.io/v1/'),
  FORCE_NO_AUTH: z.string().optional(),
  CARMBO_AUTH0_CLIENT_ID: z.string(),
  CARMBO_AUTH0_CLIENT_SECRET: z.string(),
  CARMBO_AUTH0_SESSION_SECRET: z.string(),
  CARDCOM_API_KEY: z.string(),
  CARDCOM_API_KEY_PASSWORD: z.string(),
  CARDCOM_TERMINAL_NUMBER: z.coerce.number().default(150067),
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

const appBaseUrl = env.APP_BASE_URL ? env.APP_BASE_URL : `http://${env.HOST}:${env.PORT}`

const {app, sql} = await makeApp({
  db: {
    database: env.DB_DATABASE,
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
  },
  services: {
    academyIntegration: createAcademyIntegrationService({
      accountApiKey: env.ACADEMY_CARMEL_ACCOUNT_API_KEY,
    }),
    whatsappIntegration: createWhatsAppIntegrationService({
      greenApiKey: env.GREEN_API_KEY,
      greenApiInstanceId: env.GREEN_API_INSTANCE,
      greenApiBaseUrl: new URL('https://7105.api.greenapi.com'),
    }),
    smooveIntegration: createSmooveIntegrationService({
      apiKey: env.SMOOVE_API_KEY,
      apiUrl: env.SMOOVE_API_URL,
    }),
    cardcomIntegration: createCardcomIntegrationService({
      apiKey: env.CARDCOM_API_KEY,
      apiKeyPassword: env.CARDCOM_API_KEY_PASSWORD,
      terminalNumber: env.CARDCOM_TERMINAL_NUMBER.toString(),
    }),
  },
  auth0: env.FORCE_NO_AUTH
    ? undefined
    : {
        clientId: env.CARMBO_AUTH0_CLIENT_ID,
        clientSecret: env.CARMBO_AUTH0_CLIENT_SECRET,
        domain: 'carmelegger.eu.auth0.com',
        sessionSecret: env.CARMBO_AUTH0_SESSION_SECRET,
      },
  appBaseUrl: appBaseUrl,
})

await prepareDatabase(sql)

await app.listen({port: env.PORT, host: env.HOST})
