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
  SMOOVE_API_KEY: z.string().optional().default(''),
  SMOOVE_API_URL: z.string().url().optional().default('https://rest.smoove.io/v1/'),
})

const env = EnvironmentVariablesSchema.parse(process.env)

const {app, sql} = await makeApp({
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
  smooveIntegration: createSmooveIntegrationService({
    apiKey: env.SMOOVE_API_KEY,
    apiUrl: env.SMOOVE_API_URL,
    cardComRecurringPaymentIdCustomFieldId: '',
    cardComAccountIdCustomFieldId: '',
  }),
})

await seedIfNeeded()

await app.listen({port: env.PORT, host: env.HOST})

async function seedIfNeeded() {
  const seedCount = process.env.TEST_SEED ? parseInt(process.env.TEST_SEED) : 0

  const studentCountResult = await retry(
    () => sql<{count: string}[]>`SELECT count(*) as count FROM student LIMIT 1`,
    {retries: 5, minTimeout: 1000, maxTimeout: 1000},
  )

  if (studentCountResult[0].count === '0') {
    console.log(`Seeding ${seedCount}...`)
    await Promise.all([
      TEST_seedStudents(sql, seedCount),
      TEST_seedProducts(sql, seedCount),
      TEST_seedSalesEvents(sql, seedCount, seedCount),
    ])
    console.log(`Ended seeding ${seedCount}...`)
  }
}
