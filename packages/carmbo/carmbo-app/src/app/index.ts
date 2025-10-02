import process from 'node:process'
import {makeApp} from './carmbo-app.ts'
import * as z from 'zod'
import {createAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import {createWhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'

export const EnvironmentVariablesSchema = z.object({
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.number().default(5432),
  DB_USERNAME: z.string().default('user'),
  DB_PASSWORD: z.string().default('password'),
  HOST: z.string().default('localhost'),
  PORT: z.number().default(3000),
  ACADEMY_CARMEL_ACCOUNT_API_KEY: z.string(),
  GREEN_API_KEY: z.string(),
  GREEN_API_INSTANCE: z.coerce.number(),
})

const env = EnvironmentVariablesSchema.parse(process.env)

const {app} = await makeApp({
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
  },
  academyIntegration: createAcademyIntegrationService({
    accountApiKey: env.ACADEMY_CARMEL_ACCOUNT_API_KEY,
  }),
  whatsappIntegration: createWhatsAppIntegrationService({
    greenApiKey: env.GREEN_API_KEY,
    greenApiInstanceId: env.GREEN_API_INSTANCE,
    greenApiBaseUrl: new URL('https://7105.api.greenapi.com'),
  }),
})

await app.listen({port: env.PORT, host: env.HOST})
