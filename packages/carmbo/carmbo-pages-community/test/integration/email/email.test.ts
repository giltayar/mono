import {expect, test} from '@playwright/test'
import {
  createEmailListPageModel,
  createEmailPageModel,
} from '@giltayar/carmbo-pages-community/testkit/page-model/email.model'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'
import {createFakeEmailService} from '../../../testkit/fake-email-service.ts'
import {setup} from '../common/setup.ts'
import {createMemberFixture} from '../common/member-fixture.ts'
import {addMember, DEFAULT_MEMBER_ROLES} from '../../../src/member-model.ts'
import {listEmails} from '../../../src/email/model.ts'
import {updateCommunity} from '../../../src/model.ts'
import {now, seedEmail} from './fixture.ts'

const {sql, url} = setup(import.meta.url)

test('emails navigation opens a read-only empty list', async ({page, request}) => {
  await page.goto(new URL('/communities', url()).href)
  await createAllPagesPageModel(page).header().menu().emailsMenuItem().locator.click()
  await expect(page).toHaveURL(new URL('/emails', url()).href)
  const model = createEmailListPageModel(page)
  await expect(model.empty().locator).toBeVisible()
  await expect(model.rows().locator).toHaveCount(0)
  expect((await request.post(new URL('/emails', url()).href, {data: {}})).status()).toBe(404)
})

test('shows fake-backed email metadata, member links, preview, text and raw HTML', async ({
  page,
  request,
}) => {
  const member = await createMemberFixture(sql(), now, 'Ada', 'ada@example.com')
  await addMember(
    member.communityNumber,
    member.studentNumber,
    now,
    sql(),
    DEFAULT_MEMBER_ROLES,
    undefined,
  )
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
  const database = sql()
  await database`
    UPDATE community_member SET registration_email_number = ${emailNumber}
    WHERE community_number = ${member.communityNumber} AND student_number = ${member.studentNumber}
  `
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

test('renders all statuses and failure diagnostics, including emails with no member', async ({
  page,
}) => {
  const statuses = ['sending', 'retrying', 'delivered', 'success', 'failure'] as const
  for (const status of statuses) {
    await seedEmail(sql(), {
      status,
      errorText: status === 'failure' ? 'Provider rejected <script>alert("error")</script>' : null,
    })
  }
  await page.goto(new URL('/emails', url()).href)
  const list = createEmailListPageModel(page)
  await expect(list.rows().locator).toHaveCount(5)
  for (const text of [
    'Sending',
    'Retrying',
    'Accepted by Resend',
    'Delivery confirmed',
    'Failure',
  ]) {
    await expect(list.table().locator).toContainText(text)
  }
  await expect(list.rows().row(0).cell(3).locator).toHaveText('-')
  await expect(list.rows().row(0).cell(4).locator).toHaveText('-')
  await list.rows().row(0).number().locator.click()
  await expect(createEmailPageModel(page).details().field('Error').locator).toHaveText(
    'Provider rejected <script>alert("error")</script>',
  )
})

test('sorts by creation time first, then consecutive number descending', async ({page}) => {
  const newest = await seedEmail(sql(), {createdAt: new Date('2026-02-01T00:00:00Z')})
  const older = await seedEmail(sql())
  const equalTimeLaterNumber = await seedEmail(sql())
  await page.goto(new URL('/emails', url()).href)
  const rows = createEmailListPageModel(page).rows()
  await expect(rows.locator).toHaveCount(3)
  await expect(rows.row(0).number().locator).toHaveText(String(newest))
  await expect(rows.row(1).number().locator).toHaveText(String(equalTimeLaterNumber))
  await expect(rows.row(2).number().locator).toHaveText(String(older))
})

test('searches recipient, community and student names literally and case-insensitively', async ({
  page,
}) => {
  const member = await createMemberFixture(sql(), now, 'Unique Student', 'linked@example.com')
  await addMember(
    member.communityNumber,
    member.studentNumber,
    now,
    sql(),
    DEFAULT_MEMBER_ROLES,
    undefined,
  )
  const linked = await seedEmail(sql(), {toEmail: 'linked@example.com'})
  await seedEmail(sql(), {toEmail: 'other@example.com'})
  await seedEmail(sql(), {toEmail: 'literal_address@example.com'})
  await updateCommunity(
    {communityNumber: member.communityNumber, name: 'Community 100%_'},
    undefined,
    now,
    sql(),
  )
  const database = sql()
  await database`
    UPDATE community_member SET registration_email_number = ${linked}
    WHERE community_number = ${member.communityNumber}
  `
  await page.goto(new URL('/emails', url()).href)
  const model = createEmailListPageModel(page)
  for (const query of ['LINKED@EXAMPLE', 'Community', 'unique student']) {
    await model.search().locator.fill(query)
    await expect(model.rows().locator).toHaveCount(1)
    await expect(model.rows().row(0).number().locator).toHaveText(String(linked))
  }
  await model.search().locator.fill('_address')
  await expect(model.rows().locator).toHaveCount(1)
  await expect(model.rows().row(0).locator).toContainText('literal_address@example.com')
  await model.search().locator.fill('%_')
  await expect(model.rows().locator).toHaveCount(1)
  await expect(model.rows().row(0).number().locator).toHaveText(String(linked))
  await model.search().locator.fill("' OR true --")
  await expect(model.empty().locator).toBeVisible()
})

test('retains the search query during infinite scrolling without duplicates', async ({page}) => {
  test.slow()
  for (let index = 0; index < 117; index++) {
    await seedEmail(sql(), {toEmail: `match${index}@example.com`})
  }
  await seedEmail(sql(), {toEmail: 'unrelated@example.com'})
  await page.goto(new URL('/emails?q=match', url()).href)
  const rows = createEmailListPageModel(page).rows()
  await expect(rows.locator).toHaveCount(50)
  await rows.row(49).locator.scrollIntoViewIfNeeded()
  await expect(rows.locator).toHaveCount(100)
  await rows.row(99).locator.scrollIntoViewIfNeeded()
  await expect(rows.locator).toHaveCount(117)
  await rows.row(116).locator.scrollIntoViewIfNeeded()
  await expect(rows.locator).toHaveCount(117)
  const visible = await rows.locator.allTextContents()
  expect(new Set(visible).size).toBe(117)
  expect(visible.every((row) => row.includes('match'))).toBe(true)
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
