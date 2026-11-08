import {expect, test} from '@playwright/test'
import {
  createEmailListPageModel,
  createEmailPageModel,
} from '@giltayar/carmbo-pages-email/testkit/page-model/email.model'
import {createFakeEmailService} from '../../testkit/fake-email-service.ts'
import {listEmails} from '../../src/model.ts'
import {setup} from './common/setup.ts'
import {now, seedEmail, seedMemberLink} from './common/fixture.ts'

const {sql, url} = setup(import.meta.url)

test('shows fake-backed email metadata, member links, preview, text and raw HTML', async ({
  page,
  request,
}) => {
  const fake = createFakeEmailService()
  const emailNumber = await seedEmail(
    sql(),
    {
      toEmail: 'ada@example.com',
      status: 'success',
      retryTimestamps: ['2026-01-01T11:59:59.000Z'],
      sendingTimestamps: ['2026-01-01T11:59:58.000Z', now.toISOString()],
    },
    fake,
  )
  const member = await seedMemberLink(sql(), {firstName: 'Ada', emailNumber})
  expect(fake.sentEmails).toHaveLength(1)
  await page.goto(new URL('/emails', url()).href)
  const list = createEmailListPageModel(page)
  await expect(list.rows().row(0).locator).toContainText('ada@example.com')
  await list.rows().row(0).number().locator.click()
  const detail = createEmailPageModel(page)
  await expect(detail.heading().locator).toHaveText(`Email ${emailNumber}`)
  await expect(detail.details().field('Recipient').locator).toHaveText('ada@example.com')
  await expect(detail.details().field('Purpose').locator).toHaveText('Registration email')
  await expect(detail.details().field('Status').locator).toHaveText('Delivery confirmed')
  await expect(detail.details().field('Resend email ID').locator).toHaveText(fake.sentEmails[0].id)
  await expect(detail.details().field('Community').locator).toContainText('Community')
  await expect(detail.details().field('Member').locator).toContainText('Ada Student')
  await expect(detail.details().field('Community').link().locator).toHaveAttribute(
    'href',
    `/communities/${member.communityNumber}`,
  )
  await expect(detail.details().field('Member').link().locator).toHaveAttribute('href', member.base)
  await expect(detail.details().field('Retries').timestamps().locator).toHaveCount(1)
  await expect(detail.details().field('Retries').timestamps().locator).toHaveAttribute(
    'datetime',
    '2026-01-01T11:59:59.000Z',
  )
  await expect(detail.details().field('Sending attempts').timestamps().locator).toHaveCount(2)
  for (const field of ['Created', 'Accepted by Resend', 'Delivery confirmed']) {
    await expect(detail.details().field(field).timestamps().locator).toHaveAttribute(
      'datetime',
      now.toISOString(),
    )
  }
  await expect(detail.preview().body().locator).toContainText(
    'Hello Student, welcome to Community.',
  )
  await expect(detail.plainText().locator).toContainText('Hello Student, welcome to Community.')
  const response = await request.get(new URL(`/emails/${emailNumber}/html`, url()).href)
  expect(response.headers()['content-type']).toContain('text/plain')
  expect(response.headers()['x-content-type-options']).toBe('nosniff')
  expect(await response.text()).toBe(fake.sentEmails[0].message.html)
  await detail.rawHtml().locator.click()
  await expect(page).toHaveURL(new URL(`/emails/${emailNumber}/html`, url()).href)
})

test('rejects invalid URLs and returns explicit missing-record errors', async ({request}) => {
  for (const path of [
    '/emails/0',
    '/emails/nope',
    '/emails/-1/html',
    '/emails?page=-1',
    '/emails?page=1.5',
  ]) {
    expect((await request.get(new URL(path, url()).href)).status()).toBe(400)
  }
  for (const path of ['/emails/999', '/emails/999/html']) {
    const response = await request.get(new URL(path, url()).href)
    expect(response.status()).toBe(404)
    expect(await response.text()).toContain('Email not found')
  }
  await expect(listEmails({query: '', page: -1}, sql())).rejects.toThrow()
})

test('isolates preview scripts and remote resources from the application', async ({page}) => {
  const blocked: Array<string | undefined> = []
  page.on('requestfailed', (request) => {
    if (request.url().includes('/email-tracker')) blocked.push(request.failure()?.errorText)
  })
  const number = await seedEmail(sql(), {
    html: `<p>Safe email content</p>
      <script>document.body.textContent = 'Executed script';</script>
      <img src="${new URL('/email-tracker', url()).href}">`,
  })
  await page.goto(new URL(`/emails/${number}`, url()).href)
  const preview = createEmailPageModel(page).preview()
  await expect(preview.locator).toHaveAttribute('sandbox', '')
  await expect(preview.body().locator).toContainText('Safe email content')
  await expect(preview.body().locator).not.toHaveText('Executed script')
  await expect.poll(() => blocked).toEqual(['csp'])
})
