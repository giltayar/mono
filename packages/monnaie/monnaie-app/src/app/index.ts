import process from 'node:process'
import * as z from 'zod'
import {makeApp} from './monnaie-app.ts'
import {loadEnvFile} from './env-file.ts'
import {createFirebaseAuth} from '../services/firebase-auth-impl.ts'
import {SUPPORTED_LANGUAGES} from '../commons/i18n.ts'

loadEnvFile()

const ServiceAccountSchema = z.object({
  project_id: z.string(),
  client_email: z.string(),
  private_key: z.string(),
})

const EnvironmentVariablesSchema = z.object({
  MONNAIE_HOST: z.string().default('localhost'),
  MONNAIE_PORT: z.coerce.number().default(3000),
  MONNAIE_DB_CONNECTION_STRING: z
    .string()
    .default('postgres://user:password@localhost:5432/monnaie'),
  /** The language to use when the request asks for no language we support */
  MONNAIE_LANGUAGE: z.enum(SUPPORTED_LANGUAGES).default('en'),
  /** The IANA timezone the calendar periods of the summary are calculated in */
  MONNAIE_TIMEZONE: z.string().refine(isKnownTimeZone, 'must be an IANA timezone').default('UTC'),
  /** The Firebase web API key. Public by design — the browser needs it to sign in with Google */
  MONNAIE_FIREBASE_API_KEY: z.string(),
  /** Defaults to the `<project-id>.firebaseapp.com` that Firebase provisions */
  MONNAIE_FIREBASE_AUTH_DOMAIN: z
    .string()
    .optional()
    // an empty value in `.env.local` means "unset", and must fall back like a missing one
    .transform((authDomain) => authDomain || undefined),
  /** The contents of a Firebase service account key file. A secret, and never sent to the browser */
  MONNAIE_FIREBASE_SERVICE_ACCOUNT: z.string().transform(parseServiceAccount),
})

const env = EnvironmentVariablesSchema.parse(process.env)
const serviceAccount = env.MONNAIE_FIREBASE_SERVICE_ACCOUNT

const {app} = await makeApp({
  connectionString: env.MONNAIE_DB_CONNECTION_STRING,
  language: env.MONNAIE_LANGUAGE,
  timeZone: env.MONNAIE_TIMEZONE,
  auth: createFirebaseAuth({serviceAccount, apiKey: env.MONNAIE_FIREBASE_API_KEY}),
  firebaseConfig: {
    apiKey: env.MONNAIE_FIREBASE_API_KEY,
    authDomain: env.MONNAIE_FIREBASE_AUTH_DOMAIN ?? `${serviceAccount.projectId}.firebaseapp.com`,
    projectId: serviceAccount.projectId,
  },
})

await app.listen({port: env.MONNAIE_PORT, host: env.MONNAIE_HOST})

// an unknown timezone would otherwise only be discovered by the first request that needs a summary
function isKnownTimeZone(timeZone: string) {
  return Intl.supportedValuesOf('timeZone').includes(timeZone) || timeZone === 'UTC'
}

function parseServiceAccount(value: string, ctx: z.RefinementCtx) {
  let json: unknown

  try {
    json = JSON.parse(value)
  } catch {
    ctx.addIssue('must be the JSON contents of a Firebase service account key file')

    return z.NEVER
  }

  const serviceAccount = ServiceAccountSchema.safeParse(json)

  if (!serviceAccount.success) {
    ctx.addIssue('must have a project_id, a client_email and a private_key')

    return z.NEVER
  }

  return {
    projectId: serviceAccount.data.project_id,
    clientEmail: serviceAccount.data.client_email,
    privateKey: serviceAccount.data.private_key,
  }
}
