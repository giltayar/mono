import process from 'node:process'
import {makeApp} from './carmbo-app.ts'
import * as z from 'zod'
import {createAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'

export const EnvironmentVariablesSchema = z.object({
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.number().default(5432),
  DB_USERNAME: z.string().default('user'),
  DB_PASSWORD: z.string().default('password'),
  HOST: z.string().default('localhost'),
  PORT: z.number().default(3000),
  ACADEMY_CARMEL_ACCOUNT_API_KEY: z.string(),
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
})

await app.listen({port: env.PORT, host: env.HOST})
