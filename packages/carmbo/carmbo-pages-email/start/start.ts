import {createApp, RESEND_WEBHOOK_PATH, TEST_EMAIL_PATH} from './app.ts'
import {initializePostgres} from './postgres.ts'
import {existsSync} from 'node:fs'
import {loadEnvFile} from 'node:process'
import {createResendEmailService} from '../src/emails/email-service.ts'
import {openCloudflaredTunnel} from './cloudflared-tunnel.ts'

const host = '127.0.0.1'
const port = 3000

const localEnv = new URL('../.env.local', import.meta.url)
if (existsSync(localEnv)) loadEnvFile(localEnv)
const apiKey = process.env.RESEND_API_KEY ?? process.env.RESEND_TEST_API_KEY
const from = process.env.RESEND_FROM ?? process.env.RESEND_TEST_FROM
if (!apiKey || !from) throw new Error('RESEND_API_KEY and RESEND_FROM are required')

// Run in reverse order on shutdown or failed startup.
const cleanups: (() => Promise<unknown>)[] = []
async function cleanup() {
  for (const fn of cleanups.splice(0).reverse()) await fn()
}

try {
  const database = await initializePostgres()
  cleanups.push(() => database.end())

  const tunnel = await openCloudflaredTunnel({port})
  cleanups.push(() => tunnel.close())

  const webhookUrl = new URL(RESEND_WEBHOOK_PATH, tunnel.publicUrl).href
  const emailService = await createResendEmailService({apiKey, webhookUrl})
  cleanups.push(() => emailService.dispose())

  const app = await createApp(database, {
    emailService,
    from,
    webhookSigningSecret: emailService.webhookSigningSecret,
  })
  cleanups.push(() => app.close())
  await app.listen({host, port})
  app.log.info(`Email pages are available at http://${host}:${port}/emails`)
  app.log.info(`Send a test email at http://${host}:${port}${TEST_EMAIL_PATH}`)

  // An unsigned request reaching the webhook route is rejected with 400.
  await tunnel.waitUntilReachable(webhookUrl, 400)
  app.log.info(`Resend delivery callbacks are received at ${webhookUrl}`)
} catch (error) {
  await cleanup()
  throw error
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, cleanup)
}
