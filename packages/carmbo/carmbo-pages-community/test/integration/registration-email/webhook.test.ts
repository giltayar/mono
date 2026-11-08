import {randomUUID} from 'node:crypto'
import {expect, test, type APIRequestContext, type Page} from '@playwright/test'
import {Webhook} from 'standardwebhooks'
import {createCommunityMemberPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/community-member.model'
import {
  createEmailListPageModel,
  createEmailPageModel,
} from '@giltayar/carmbo-pages-email/testkit/page-model/email.model'
import {addMember, DEFAULT_MEMBER_ROLES} from '../../../src/member-model.ts'
import {setup} from '../common/setup.ts'
import {createMemberFixture} from '../common/member-fixture.ts'

let now = new Date('2026-11-07T10:00:00Z')
const {sql, url, emailService, registrationEmail, executeJobs, webhookSigningSecret} = setup(
  import.meta.url,
  {
    nowService: () => now,
  },
)

test.beforeEach(() => {
  now = new Date('2026-11-07T10:00:00Z')
})

async function enqueue() {
  const fixture = await createMemberFixture(sql(), now, 'Alice', 'alice@example.com')
  await addMember(
    fixture.communityNumber,
    fixture.studentNumber,
    now,
    sql(),
    DEFAULT_MEMBER_ROLES,
    registrationEmail(),
  )
  return fixture
}

async function openEmail(page: Page) {
  await page.goto(new URL('/emails', url()).href)
  await createEmailListPageModel(page).rows().row(0).number().locator.click()
  const email = createEmailPageModel(page)
  const tags = JSON.parse(await email.details().field('Tags').locator.innerText())
  return {
    email,
    correlationId: tags.carmbo_email_id as string,
    providerEmailId: await email.details().field('Resend email ID').locator.innerText(),
  }
}

async function openMember(page: Page, base: string) {
  await page.goto(new URL(base, url()).href)
  return createCommunityMemberPageModel(page)
}

function resendEvent(
  type: string,
  {
    providerEmailId,
    correlationId,
    createdAt,
    data = {},
  }: {
    providerEmailId: string
    correlationId?: string
    createdAt: Date
    data?: Record<string, unknown>
  },
) {
  return {
    type,
    created_at: createdAt.toISOString(),
    data: {
      email_id: providerEmailId,
      created_at: now.toISOString(),
      from: 'Community <sender@example.com>',
      to: ['alice@example.com'],
      subject: 'Welcome to Community',
      tags: correlationId ? {carmbo_email_id: correlationId} : {},
      ...data,
    },
  }
}

async function postEvent(
  request: APIRequestContext,
  event: unknown,
  {secret = webhookSigningSecret, signedBody}: {secret?: string; signedBody?: string} = {},
) {
  const body = JSON.stringify(event)
  const id = `msg_${randomUUID()}`
  const timestamp = new Date()
  return request.post(new URL('/api/emails/resend/webhook', url()).href, {
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'svix-signature': new Webhook(secret).sign(id, timestamp, signedBody ?? body),
    },
    data: body,
  })
}

async function acceptedEmail(page: Page) {
  const fixture = await enqueue()
  await executeJobs()
  return {...fixture, ...(await openEmail(page))}
}

test('a signed delivery callback confirms delivery without changing the membership', async ({
  page,
  request,
}) => {
  const {email, providerEmailId, base} = await acceptedEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')
  const deliveredAt = new Date('2026-11-07T10:00:07Z')

  const response = await postEvent(
    request,
    resendEvent('email.delivered', {providerEmailId, createdAt: deliveredAt}),
  )
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({outcome: 'applied'})

  await page.reload()
  await expect(email.details().field('Status').locator).toHaveText('Delivery confirmed')
  await expect(email.details().field('Delivery confirmed').timestamps().locator).toHaveAttribute(
    'datetime',
    deliveredAt.toISOString(),
  )
  await expect(email.details().field('Error').locator).toHaveText('-')

  const member = await openMember(page, base)
  await expect(member.state().field('Status').locator).toHaveText('Registration email sent')
  await expect(member.history().items().locator).toHaveCount(2)
})

for (const [type, data, errorText] of [
  [
    'email.bounced',
    {bounce: {message: 'Unknown user', subType: 'General', type: 'Permanent'}},
    'Bounced: Unknown user',
  ],
  ['email.failed', {failed: {reason: 'reached_daily_quota'}}, 'Failed: reached_daily_quota'],
  [
    'email.suppressed',
    {suppressed: {message: 'Previously bounced', type: 'OnAccountSuppressionList'}},
    'Suppressed: Previously bounced',
  ],
] as const) {
  test(`a signed ${type} callback marks the email failed without changing the membership`, async ({
    page,
    request,
  }) => {
    const {email, providerEmailId, base} = await acceptedEmail(page)

    const response = await postEvent(
      request,
      resendEvent(type, {providerEmailId, createdAt: new Date('2026-11-07T10:00:07Z'), data}),
    )
    expect(await response.json()).toEqual({outcome: 'applied'})

    await page.reload()
    await expect(email.details().field('Status').locator).toHaveText('Failure')
    await expect(email.details().field('Error').locator).toHaveText(errorText)
    await expect(email.details().field('Delivery confirmed').timestamps().locator).toHaveCount(0)
    const member = await openMember(page, base)
    await expect(member.state().field('Status').locator).toHaveText('Registration email sent')
    await expect(member.history().items().locator).toHaveCount(2)
  })
}

test('a callback during a lost API response is kept, and the retry neither resends nor regresses it', async ({
  page,
  request,
}) => {
  const {base} = await enqueue()
  emailService().failNextSend(new Error('Lost response'), {afterAcceptance: true})
  await executeJobs()
  const {email, correlationId, providerEmailId} = await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Retrying')
  expect(providerEmailId).toBe('-')

  const sentId = emailService().sentEmails[0].id
  const response = await postEvent(
    request,
    resendEvent('email.delivered', {
      providerEmailId: sentId,
      correlationId,
      createdAt: new Date('2026-11-07T10:00:07Z'),
    }),
  )
  expect(await response.json()).toEqual({outcome: 'applied'})
  await page.reload()
  await expect(email.details().field('Status').locator).toHaveText('Delivery confirmed')
  await expect(email.details().field('Resend email ID').locator).toHaveText(sentId)

  now = new Date('2026-11-07T10:00:09Z')
  await executeJobs()
  expect(emailService().attempts).toHaveLength(1)
  await page.reload()
  await expect(email.details().field('Status').locator).toHaveText('Delivery confirmed')
  await expect(email.details().field('Accepted by Resend').timestamps().locator).toHaveAttribute(
    'datetime',
    now.toISOString(),
  )
  const member = await openMember(page, base)
  await expect(member.state().field('Status').locator).toHaveText('Registration email sent')
})

test('a callback arriving while the final attempt fails records acceptance, not failure', async ({
  page,
  request,
}) => {
  const {base} = await enqueue()
  const {correlationId} = await openEmail(page)
  for (let attempt = 0; attempt < 3; attempt++) {
    emailService().failNextSend(new Error('Temporary failure'))
    await executeJobs()
  }
  const fake = emailService()
  const send = fake.sendEmail.bind(fake)
  fake.failNextSend(new Error('Lost final response'), {afterAcceptance: true})
  fake.sendEmail = async (message, options) => {
    try {
      return await send(message, options)
    } finally {
      await postEvent(
        request,
        resendEvent('email.delivered', {
          providerEmailId: fake.sentEmails[0].id,
          correlationId,
          createdAt: new Date('2026-11-07T10:00:07Z'),
        }),
      )
    }
  }
  await executeJobs()

  const {email} = await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Delivery confirmed')
  const jobId = await email.details().field('Job ID').locator.innerText()
  await page.goto(new URL(`/jobs/${jobId}`, url()).href)
  // The jobs page keeps showing an earlier attempt's error; the final attempt must not add its own.
  await expect(page.getByRole('heading', {level: 2})).not.toContainText('Lost final response')
  await expect(page.getByText('Finished: still working...', {exact: true})).toHaveCount(0)
  const member = await openMember(page, base)
  await expect(member.state().field('Status').locator).toHaveText('Registration email sent')
  await expect(member.history().link('Registration failed').locator).toHaveCount(0)
})
