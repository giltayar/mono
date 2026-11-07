import {createApp} from './app.ts'
import {initializePostgres} from './postgres.ts'
import {existsSync} from 'node:fs'
import {loadEnvFile} from 'node:process'
import {createResendEmailService} from '../src/email/email-service.ts'

const host = '127.0.0.1'
const port = 3000

const localEnv = new URL('../.env.local', import.meta.url)
if (existsSync(localEnv)) loadEnvFile(localEnv)
const apiKey = process.env.RESEND_API_KEY ?? process.env.RESEND_TEST_API_KEY
const from = process.env.RESEND_FROM ?? process.env.RESEND_TEST_FROM
if (!apiKey || !from) throw new Error('RESEND_API_KEY and RESEND_FROM are required')

const emailService = createResendEmailService({apiKey})
const database = await initializePostgres()
const app = await createApp(database, {emailService, from})
await app.listen({host, port})

app.log.info(`Community pages are available at http://${host}:${port}/communities`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close()
    await database.end()
  })
}
