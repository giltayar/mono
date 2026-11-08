import {randomUUID} from 'node:crypto'
import {expect, test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import {migrate} from '@giltayar/carmbo-commons/sql/migration'
import {createTemplatePageModel} from '@giltayar/carmbo-pages-email/testkit/page-model/template.model'
import {createFakeEmailService} from '@giltayar/carmbo-pages-email/testkit/email-service'
import postgres from 'postgres'
import {createApp} from '../../start/app.ts'

test('standalone app creates a template, sends a preview, and reopens the saved template', async ({
  page,
}) => {
  const docker = await runDockerCompose(
    new URL('../integration/docker-compose.yaml', import.meta.url),
    {
      variation: `template-e2e-${randomUUID()}`,
      containerCleanup: true,
    },
  )
  const connection = {database: 'carmbo', user: 'user', password: 'password'}
  const address = await docker.findAddress('carmbo-postgres', 5432, {
    healthCheck: async (candidate) => {
      const [host, port] = candidate.split(':')
      const sql = postgres({host, port: Number(port), ...connection})
      try {
        await sql`SELECT 1`
      } finally {
        await sql.end()
      }
    },
  })
  const [host, port] = address.split(':')
  const sql = postgres({host, port: Number(port), ...connection, transform: {...postgres.camel}})
  try {
    await migrate({sql})
    const emailService = createFakeEmailService()
    const app = await createApp(sql, {
      emailService,
      from: 'sender@example.com',
      webhookSigningSecret: 'whsec_dGVzdA==',
    })
    try {
      app.log.level = 'warn'
      const address = await app.listen({host: '127.0.0.1', port: 0})
      const template = createTemplatePageModel(page)
      await page.goto(`${address}/emails/templates/new`)
      await template.name().locator.fill('Standalone template')
      await template.subject().locator.fill('Hello {{name}}')
      await template.content().locator.fill('Welcome {{name}}')
      await template.text().locator.fill('Plain welcome {{name}}')
      await template.sample('name').locator.fill('Alice')
      await template.action('Save template').locator.click()
      await expect(page).toHaveURL(/\/emails\/templates\/1$/)
      await template.action('Send preview email').locator.click()
      await template.recipient().locator.fill('preview@example.com')
      await template.action('Send').locator.click()
      await expect(template.status().locator).toContainText('accepted')
      expect(emailService.sentEmails).toHaveLength(1)
      expect(emailService.sentEmails[0].message.text).toBe('Plain welcome Alice')
      await page.reload()
      await expect(template.content().locator).toContainText('Welcome {{name}}')
      await expect(template.sample('name').locator).toHaveValue('Alice')
    } finally {
      await app.close()
    }
  } finally {
    await sql.end()
    await docker.teardown()
  }
})
