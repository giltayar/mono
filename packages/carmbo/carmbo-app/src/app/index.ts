import process from 'node:process'
import {makeApp} from './carmbo-app.ts'
import * as z from 'zod'
import retry from 'p-retry'
import {createAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import {createWhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'
import {createSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import {TEST_seedStudents} from '../domain/student/model.ts'
import {TEST_seedProducts} from '../domain/product/model.ts'
import {TEST_seedSalesEvents} from '../domain/sales-event/model.ts'
import {throw_} from '@giltayar/functional-commons'
import {migrate} from '../sql/migration.ts'
import {fileURLToPath} from 'node:url'

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

await migrate({sql, path: fileURLToPath(new URL('../sql', import.meta.url))})

await seedIfNeeded()

await app.listen({port: env.PORT, host: env.HOST})

async function seedIfNeeded() {
  const seedCount = process.env.TEST_SEED ? parseInt(process.env.TEST_SEED) : 0

  const studentCountResult =
    seedCount > 0
      ? await retry(() => sql<{count: string}[]>`SELECT count(*) as count FROM student LIMIT 1`, {
          retries: 5,
          minTimeout: 1000,
          maxTimeout: 1000,
        })
      : [{count: 1111}]

  if (studentCountResult[0].count === '0') {
    console.log(`Seeding ${seedCount}...`)
    await Promise.all([
      TEST_seedStudents(sql, undefined, seedCount),
      TEST_seedProducts(sql, seedCount),
      TEST_seedSalesEvents(sql, seedCount, seedCount),
    ])
    console.log(`Ended seeding ${seedCount}...`)
  }
}
