import {randomUUID} from 'node:crypto'
import {expect, test, type APIRequestContext, type Page} from '@playwright/test'
import {Webhook} from 'standardwebhooks'
import {
  createEmailListPageModel,
  createEmailPageModel,
} from '@giltayar/carmbo-pages-email/testkit/page-model/email.model'
import {setup} from './common/setup.ts'

let now = new Date('2026-11-07T10:00:00Z')
const {url, emailService, queue, results, executeJobs, webhookSigningSecret} = setup(
  import.meta.url,
  {
    nowService: () => now,
  },
)

test.beforeEach(() => {
  now = new Date('2026-11-07T10:00:00Z')
})

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
  await queue()
  await executeJobs()
  return openEmail(page)
}

function expectSingleAcceptedResult() {
  expect(results()).toHaveLength(1)
  expect(results()[0].result).toHaveProperty('sentAt')
}

test('a signed delivery callback confirms delivery without reporting another result', async ({
  page,
  request,
}) => {
  const {email, providerEmailId} = await acceptedEmail(page)
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

  expectSingleAcceptedResult()
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
  test(`a signed ${type} callback marks the email failed without reporting another result`, async ({
    page,
    request,
  }) => {
    const {email, providerEmailId} = await acceptedEmail(page)

    const response = await postEvent(
      request,
      resendEvent(type, {providerEmailId, createdAt: new Date('2026-11-07T10:00:07Z'), data}),
    )
    expect(await response.json()).toEqual({outcome: 'applied'})

    await page.reload()
    await expect(email.details().field('Status').locator).toHaveText('Failure')
    await expect(email.details().field('Error').locator).toHaveText(errorText)
    await expect(email.details().field('Delivery confirmed').timestamps().locator).toHaveCount(0)
    expectSingleAcceptedResult()
  })
}

test('duplicate and out-of-order callbacks never regress the latest provider state', async ({
  page,
  request,
}) => {
  const {email, providerEmailId} = await acceptedEmail(page)
  const delivered = resendEvent('email.delivered', {
    providerEmailId,
    createdAt: new Date('2026-11-07T10:00:10Z'),
  })
  const bounce = {bounce: {message: 'Unknown user', subType: 'General', type: 'Permanent'}}

  expect(await (await postEvent(request, delivered)).json()).toEqual({outcome: 'applied'})
  expect(await (await postEvent(request, delivered)).json()).toEqual({outcome: 'stale'})
  const olderBounce = resendEvent('email.bounced', {
    providerEmailId,
    createdAt: new Date('2026-11-07T10:00:05Z'),
    data: bounce,
  })
  expect(await (await postEvent(request, olderBounce)).json()).toEqual({outcome: 'stale'})

  await page.reload()
  await expect(email.details().field('Status').locator).toHaveText('Delivery confirmed')
  await expect(email.details().field('Delivery confirmed').timestamps().locator).toHaveAttribute(
    'datetime',
    '2026-11-07T10:00:10.000Z',
  )

  const laterBounce = resendEvent('email.bounced', {
    providerEmailId,
    createdAt: new Date('2026-11-07T10:00:20Z'),
    data: bounce,
  })
  expect(await (await postEvent(request, laterBounce)).json()).toEqual({outcome: 'applied'})
  await page.reload()
  await expect(email.details().field('Status').locator).toHaveText('Failure')
})

test('unsigned, tampered, wrongly signed, and malformed callbacks are rejected', async ({
  page,
  request,
}) => {
  const {email, providerEmailId} = await acceptedEmail(page)
  const delivered = resendEvent('email.delivered', {providerEmailId, createdAt: now})
  const webhookUrl = new URL('/api/emails/resend/webhook', url()).href

  const unsigned = await request.post(webhookUrl, {
    headers: {'content-type': 'application/json'},
    data: JSON.stringify(delivered),
  })
  expect(unsigned.status()).toBe(400)
  const wrongSecret = await postEvent(request, delivered, {
    secret: `whsec_${Buffer.from('a-different-webhook-secret-value!').toString('base64')}`,
  })
  expect(wrongSecret.status()).toBe(400)
  const tampered = await postEvent(request, delivered, {
    signedBody: JSON.stringify({...delivered, type: 'email.opened'}),
  })
  expect(tampered.status()).toBe(400)
  const malformed = await postEvent(request, {type: 'email.delivered', created_at: 'not a date'})
  expect(malformed.status()).toBe(400)
  expect(await malformed.json()).toEqual({error: 'Invalid webhook payload'})

  await page.reload()
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')
})

test('unrelated and unsupported events are acknowledged without changes', async ({
  page,
  request,
}) => {
  const {email, providerEmailId} = await acceptedEmail(page)

  const unrelated = await postEvent(
    request,
    resendEvent('email.delivered', {
      providerEmailId: 'another-apps-email',
      correlationId: randomUUID(),
      createdAt: now,
    }),
  )
  expect(unrelated.status()).toBe(200)
  expect(await unrelated.json()).toEqual({outcome: 'unknown-email'})
  const opened = await postEvent(
    request,
    resendEvent('email.opened', {providerEmailId, createdAt: now}),
  )
  expect(opened.status()).toBe(200)
  expect(await opened.json()).toEqual({outcome: 'unsupported'})

  await page.reload()
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')
})

test('a callback during a lost API response is kept, and the retry neither resends nor regresses it', async ({
  page,
  request,
}) => {
  await queue()
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
  expectSingleAcceptedResult()
})

test('a callback arriving while the final attempt fails records acceptance, not failure', async ({
  page,
  request,
}) => {
  await queue()
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
  expectSingleAcceptedResult()
})
