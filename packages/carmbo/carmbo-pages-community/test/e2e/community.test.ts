import {randomUUID} from 'node:crypto'
import {createServer} from 'node:net'
import {expect, test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import {migrate} from '@giltayar/carmbo-commons/sql/migration'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'
import {createCommunityListPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/community-list-page.model'
import {
  createCommunityMemberPageModel,
  createCommunityMembersPageModel,
} from '@giltayar/carmbo-pages-community/testkit/page-model/community-member.model'
import {
  createEmailListPageModel,
  createEmailPageModel,
} from '@giltayar/carmbo-pages-community/testkit/page-model/email.model'
import {createNewCommunityMemberPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-member-page.model'
import {createNewCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-page.model'
import {createUpdateCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/update-community-page.model'
import type {FastifyInstance} from 'fastify'
import postgres, {type Sql} from 'postgres'
import {createResendEmailService, type ResendEmailService} from '../../src/email/email-service.ts'
import {createApp, RESEND_WEBHOOK_PATH} from '../../start/app.ts'
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

test('a new community member receives a registration email that Resend confirms as delivered', async ({
  page,
}) => {
  const run = randomUUID()
  const recipient = `delivered+${run}@resend.dev`

  await page.goto(`${baseUrl}/communities`)
  await createCommunityListPageModel(page).createNewCommunityButton().locator.click()
  const newCommunity = createNewCommunityPageModel(page)
  await newCommunity
    .form()
    .nameInput()
    .locator.fill(`E2E community ${run.slice(0, 8)}`)
  await newCommunity.form().createButton().locator.click()
  await page.waitForURL(createUpdateCommunityPageModel(page).urlRegex)

  const members = createCommunityMembersPageModel(page)
  await members.tabs().members().locator.click()
  await members.add().locator.click()

  const newMember = createNewCommunityMemberPageModel(page)
  await newMember.studentDialog().open().locator.click()
  await newMember.create().open().locator.click()
  await newMember.create().input('firstName').locator.fill('E2E')
  await newMember.create().input('lastName').locator.fill('Student')
  await newMember.create().input('email').locator.fill(recipient)
  await newMember.create().submit().locator.click()
  await expect(newMember.email().locator).toHaveValue(recipient)
  await newMember.submit().locator.click()

  const member = createCommunityMemberPageModel(page)
  await page.waitForURL(member.urlRegex)
  // The status panel refreshes itself while the email is being sent.
  await expect(member.state().field('Status').locator).toHaveText('Registration email sent', {
    timeout: 90_000,
  })

  await createAllPagesPageModel(page).header().menu().emailsMenuItem().locator.click()
  const emails = createEmailListPageModel(page)
  await emails.search().locator.fill(recipient)
  await expect(emails.rows().locator).toHaveCount(1)
  await emails.rows().row(0).number().locator.click()

  const email = createEmailPageModel(page)
  await expect(email.details().field('Recipient').locator).toHaveText(recipient)
  // The email page does not refresh itself; the delivery callback arrives in the background.
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
})

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const {port} = server.address() as {port: number}
  await new Promise((resolve) => server.close(resolve))
  return port
}
