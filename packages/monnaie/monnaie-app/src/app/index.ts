import process from 'node:process'
import * as z from 'zod'
import {makeApp} from './monnaie-app.ts'
import {SUPPORTED_LANGUAGES} from '../commons/i18n.ts'
import {createFirebaseAuth} from '../commons/firebase-auth.ts'

const EnvironmentVariablesSchema = z.object({
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(3000),
  DB_CONNECTION_STRING: z.string().default('postgres://user:password@localhost:5432/monnaie'),
  /** The language to use when the request asks for no language we support */
  LANGUAGE: z.enum(SUPPORTED_LANGUAGES).default('en'),
  /** The whole service account JSON of the firebase project, as downloaded from its console */
  MONNAIE_FIREBASE_SERVICE_ACCOUNT_JSON: z.string(),
  /** The web API key of the firebase project. It is public, and is served to the browser as such */
  MONNAIE_FIREBASE_API_KEY: z.string(),
  /** Only ever turned off when serving over plain http, which in practice means the e2e tests */
  SECURE_COOKIES: z.stringbool().default(true),
})

const env = EnvironmentVariablesSchema.parse(process.env)

const {app} = await makeApp({
  connectionString: env.DB_CONNECTION_STRING,
  language: env.LANGUAGE,
  auth: createFirebaseAuth({
    serviceAccountJson: env.MONNAIE_FIREBASE_SERVICE_ACCOUNT_JSON,
    apiKey: env.MONNAIE_FIREBASE_API_KEY,
  }),
  secureCookies: env.SECURE_COOKIES,
})

await app.listen({port: env.PORT, host: env.HOST})
