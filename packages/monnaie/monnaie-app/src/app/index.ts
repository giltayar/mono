import process from 'node:process'
import * as z from 'zod'
import {makeApp} from './monnaie-app.ts'
import {SUPPORTED_LANGUAGES} from '../commons/i18n.ts'

const EnvironmentVariablesSchema = z.object({
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(3000),
  DB_CONNECTION_STRING: z.string().default('postgres://user:password@localhost:5432/monnaie'),
  /** The language to use when the request asks for no language we support */
  LANGUAGE: z.enum(SUPPORTED_LANGUAGES).default('en'),
})

const env = EnvironmentVariablesSchema.parse(process.env)

const {app} = await makeApp({
  connectionString: env.DB_CONNECTION_STRING,
  language: env.LANGUAGE,
})

await app.listen({port: env.PORT, host: env.HOST})
