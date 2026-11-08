import {randomUUID} from 'node:crypto'
import {createServer} from 'node:net'
import {expect, test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import {migrate} from '@giltayar/carmbo-commons/sql/migration'
import {
  createEmailListPageModel,
  createEmailPageModel,
} from '@giltayar/carmbo-pages-email/testkit/page-model/email.model'
import type {FastifyInstance} from 'fastify'
import postgres, {type Sql} from 'postgres'
import {createResendEmailService, type ResendEmailService} from '../../src/email-service.ts'
import {createApp, RESEND_WEBHOOK_PATH, TEST_EMAIL_PATH} from '../../start/app.ts'
import {openCloudflaredTunnel, type CloudflaredTunnel} from '../../start/cloudflared-tunnel.ts'

let database: Sql | undefined
let teardown: (() => Promise<void>) | undefined
let tunnel: CloudflaredTunnel | undefined
let emailService: ResendEmailService | undefined
let app: FastifyInstance | undefined
let baseUrl: string

test.beforeAll(async () => {
  const apiKey = process.env.RESEND_TEST_API_KEY ?? process.env.RESEND_API_KEY
  const from = process.env.RESEND_TEST_FROM ?? process.env.RESEND_FROM
  if (!apiKey || !from) {
    throw new Error('Set RESEND_TEST_API_KEY and RESEND_TEST_FROM (or RESEND_API_KEY/RESEND_FROM)')
  }

  const dockerCompose = await runDockerCompose(
    new URL('../integration/docker-compose.yaml', import.meta.url),
    {variation: 'e2e'},
  )
  teardown = dockerCompose.teardown
  const connection = {database: 'carmbo', user: 'user', password: 'password'}
  const address = await dockerCompose.findAddress('carmbo-postgres', 5432, {
    healthCheck: async (candidate) => {
      const [host, port] = candidate.split(':')
      const healthSql = postgres({host, port: Number(port), ...connection})
      await healthSql`SELECT 1`
      await healthSql.end()
    },
  })
  const [host, port] = address.split(':')
  database = postgres({host, port: Number(port), ...connection, transform: {...postgres.camel}})
  await migrate({sql: database})

  const appPort = await freePort()
  tunnel = await openCloudflaredTunnel({port: appPort})
  const webhookUrl = new URL(RESEND_WEBHOOK_PATH, tunnel.publicUrl).href
  emailService = await createResendEmailService({apiKey, webhookUrl})
  app = await createApp(database, {
    emailService,
    from,
    webhookSigningSecret: emailService.webhookSigningSecret,
  })
  app.log.level = 'warn'
  baseUrl = await app.listen({host: '127.0.0.1', port: appPort})
  await tunnel.waitUntilReachable(webhookUrl, 400)
})

test.afterAll(async () => {
  await app?.close()
  await emailService?.dispose()
  await tunnel?.close()
  await database?.end()
  await teardown?.()
})

test('a queued email is sent through Resend and confirmed as delivered by its callback', async ({
  page,
}) => {
  const run = randomUUID()
  const recipient = `delivered+${run}@resend.dev`

  await page.goto(`${baseUrl}${TEST_EMAIL_PATH}`)
  await page.getByRole('textbox', {name: 'To', exact: true}).fill(recipient)
  await page
    .getByRole('textbox', {name: 'Subject', exact: true})
    .fill(`E2E email ${run.slice(0, 8)}`)
  await page.getByRole('button', {name: 'Send'}).click()

  const email = createEmailPageModel(page)
  await expect(email.details().field('Recipient').locator).toHaveText(recipient)
  // The email page does not refresh itself; sending and the delivery callback happen in the background.
  await expect
    .poll(
      async () => {
        await page.reload()
        return email.details().field('Status').locator.innerText()
      },
      {timeout: 90_000, intervals: [1000, 2000, 3000]},
    )
    .toBe('Delivery confirmed')
  await expect(email.details().field('Delivery confirmed').timestamps().locator).toHaveCount(1)

  await page.goto(`${baseUrl}/emails`)
  const emails = createEmailListPageModel(page)
  await emails.search().locator.fill(recipient)
  await expect(emails.rows().locator).toHaveCount(1)
})

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const {port} = server.address() as {port: number}
  await new Promise((resolve) => server.close(resolve))
  return port
}
