import {expect, test, type Page} from '@playwright/test'
import {
  createEmailListPageModel,
  createEmailPageModel,
} from '@giltayar/carmbo-pages-email/testkit/page-model/email.model'
import {TEST_resetJobHandlers} from '@giltayar/carmbo-pages-job/testkit'
import {createApp} from '../../start/app.ts'
import {setup} from './common/setup.ts'

let now = new Date('2026-11-07T10:00:00Z')
const {sql, url, emailService, queue, queueEmail, results, onResult, executeJobs} = setup(
  import.meta.url,
  {nowService: () => now},
)

const payload = {communityNumber: 1, studentNumber: 2}

test.beforeEach(() => {
  now = new Date('2026-11-07T10:00:00Z')
})

async function openEmail(page: Page) {
  await page.goto(new URL('/emails', url()).href)
  await createEmailListPageModel(page).rows().row(0).number().locator.click()
  return createEmailPageModel(page)
}

async function openJob(page: Page) {
  const jobId = await createEmailPageModel(page).details().field('Job ID').locator.innerText()
  await page.goto(new URL(`/jobs/${jobId}`, url()).href)
  return page.getByRole('heading', {level: 2})
}

test('a queued email is sent only after commit, with its saved tags and idempotency key', async ({
  page,
}) => {
  const {emailNumber, jobId} = await queue({payload})
  const email = await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Sending')
  await expect(email.details().field('Job ID').locator).toHaveText(String(jobId))
  const job = await openJob(page)
  await expect(job).toContainText('Send email (communityNumber: 1, studentNumber: 2)')
  await expect(page.getByText('Finished: still working...', {exact: true})).toBeVisible()
  expect(emailService().attempts).toHaveLength(0)

  await executeJobs()
  await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')
  await expect(email.details().field('Recipient').locator).toHaveText('alice@example.com')
  await expect(email.details().field('Subject').locator).toHaveText('Welcome to Community')
  await expect(email.preview().body().locator).toContainText('Alice Student')
  await expect(email.details().field('Delivery confirmed').timestamps().locator).toHaveCount(0)
  await expect(email.details().field('Accepted by Resend').timestamps().locator).toHaveAttribute(
    'datetime',
    now.toISOString(),
  )
  await expect(email.details().field('Sending attempts').timestamps().locator).toHaveAttribute(
    'datetime',
    now.toISOString(),
  )
  await expect(email.details().field('Retries').timestamps().locator).toHaveCount(0)
  expect(emailService().sentEmails).toHaveLength(1)
  const tags = JSON.parse(await email.details().field('Tags').locator.innerText())
  expect(Object.keys(tags).sort()).toEqual(['carmbo_email_id', 'job_id'])
  expect(tags.job_id).toBe(String(jobId))
  expect(emailService().attempts[0].message).toEqual({
    from: 'Sender <sender@example.com>',
    to: 'alice@example.com',
    subject: 'Welcome to Community',
    html: '<p>Hello Alice Student, welcome to Community.</p>',
    text: 'Hello Alice Student, welcome to Community.',
    tags,
  })
  expect(emailService().attempts[0].options.idempotencyKey).toBe(
    `registration-email/${tags.carmbo_email_id}`,
  )
  expect(results()).toEqual([{emailNumber, payload, result: {sentAt: now}, now}])

  await executeJobs()
  expect(emailService().attempts).toHaveLength(1)
  expect(results()).toHaveLength(1)
})

test('rolling back the caller transaction discards the email and its job', async ({page}) => {
  await expect(
    sql().begin(async (tx) => {
      await queueEmail()(
        {
          purpose: 'registration-email',
          from: 'sender@example.com',
          to: 'alice@example.com',
          subject: 'Subject',
          html: '<p>Body</p>',
          text: 'Body',
          language: 'en',
          payload,
        },
        now,
        tx,
      )
      throw new Error('Caller failed')
    }),
  ).rejects.toThrow('Caller failed')
  await page.goto(new URL('/emails', url()).href)
  await expect(createEmailListPageModel(page).empty().locator).toBeVisible()
  await page.goto(new URL('/jobs', url()).href)
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(0)
  await executeJobs()
  expect(emailService().attempts).toHaveLength(0)
})

test('retries keep the exact saved payload and key, with eventual acceptance', async ({page}) => {
  const {emailNumber} = await queue()
  emailService().failNextSend(new Error('Temporary provider failure'))
  await executeJobs()
  const email = await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Retrying')
  await expect(email.details().field('Error').locator).toHaveText('Temporary provider failure')
  await expect(email.details().field('Sending attempts').timestamps().locator).toHaveCount(1)
  await expect(email.details().field('Retries').timestamps().locator).toHaveCount(0)
  expect(results()).toHaveLength(0)

  now = new Date(now.getTime() + 1000)
  await executeJobs()
  await page.reload()
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')
  await expect(email.details().field('Error').locator).toHaveText('-')
  await expect(email.details().field('Retries').timestamps().locator).toHaveAttribute(
    'datetime',
    now.toISOString(),
  )
  await expect(email.details().field('Sending attempts').timestamps().locator).toHaveCount(2)
  expect(emailService().attempts[1].message).toEqual(emailService().attempts[0].message)
  expect(emailService().attempts[1].options).toEqual(emailService().attempts[0].options)
  expect(results()).toEqual([{emailNumber, payload, result: {sentAt: now}, now}])
})

test('four failed attempts exhaust the job and report the last error to the result handler', async ({
  page,
}) => {
  const {emailNumber} = await queue()
  for (let attempt = 0; attempt < 4; attempt++) {
    emailService().failNextSend(new Error(`Provider failure ${attempt}`))
    await executeJobs()
    now = new Date(now.getTime() + 1000)
  }
  const email = await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Failure')
  await expect(email.details().field('Error').locator).toHaveText('Provider failure 3')
  await expect(email.details().field('Sending attempts').timestamps().locator).toHaveCount(4)
  await expect(email.details().field('Retries').timestamps().locator).toHaveCount(3)
  const job = await openJob(page)
  await expect(job).toContainText('Provider failure 3')
  await expect(page.getByText(/^Finished:/)).not.toContainText('still working...')
  expect(results()).toEqual([
    {
      emailNumber,
      payload,
      result: {errorText: 'Provider failure 3'},
      now: new Date('2026-11-07T10:00:03Z'),
    },
  ])
  await executeJobs()
  expect(emailService().attempts).toHaveLength(4)
})

test('a lost response is retried with the same key and sends only once', async ({page}) => {
  await queue()
  emailService().failNextSend(new Error('Lost response'), {afterAcceptance: true})
  await executeJobs()
  const email = await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Retrying')
  expect(emailService().sentEmails).toHaveLength(1)
  expect(results()).toHaveLength(0)
  await executeJobs()
  await page.reload()
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')
  expect(emailService().sentEmails).toHaveLength(1)
  expect(emailService().attempts).toHaveLength(2)
  expect(results()).toHaveLength(1)
})

test('provider calls hold no database transaction open, and concurrent triggers send once', async ({
  page,
}) => {
  await queue()
  const fake = emailService()
  const send = fake.sendEmail.bind(fake)
  fake.sendEmail = async (message, options) => {
    // Lock availability cannot be observed through the UI.
    await sql().begin(async (tx) => {
      await tx`SELECT email_number FROM email FOR UPDATE NOWAIT`
    })
    return send(message, options)
  }
  await Promise.all([executeJobs(), executeJobs()])
  expect(fake.attempts).toHaveLength(1)
  const email = await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')
})

test('a result handler failure after provider acceptance retries the identical request without duplicate sends', async ({
  page,
}) => {
  await queue()
  onResult.hook = async () => {
    throw new Error('Result write failed')
  }
  await executeJobs()
  expect(emailService().sentEmails).toHaveLength(1)
  const email = await openEmail(page)
  await expect(email.details().field('Resend email ID').locator).toHaveText('-')
  await expect(email.details().field('Status').locator).toHaveText('Sending')
  const job = await openJob(page)
  await expect(job).toContainText('Result write failed')
  expect(results()).toHaveLength(0)

  onResult.hook = undefined
  await executeJobs()
  expect(emailService().sentEmails).toHaveLength(1)
  expect(emailService().attempts).toHaveLength(2)
  expect(emailService().attempts[1]).toEqual({
    ...emailService().attempts[0],
    timestamp: emailService().attempts[1].timestamp,
  })
  await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')
  expect(results()).toHaveLength(1)
})

test('the last allowed attempt may succeed without reporting a failure', async ({page}) => {
  const {emailNumber} = await queue()
  for (let index = 0; index < 3; index++) {
    emailService().failNextSend(new Error('Temporary failure'))
    await executeJobs()
  }
  await executeJobs()
  const email = await openEmail(page)
  await expect(email.details().field('Status').locator).toHaveText('Accepted by Resend')
  expect(results()).toEqual([{emailNumber, payload, result: {sentAt: now}, now}])
})

// Replaces this file's job handler registration, so it must stay the last test in the file.
test('the standalone host registers the handler without result handlers and executes persisted jobs after restart', async ({
  page,
}) => {
  await queue()
  TEST_resetJobHandlers()
  const app = await createApp(sql(), {
    emailService: emailService(),
    from: 'sender@example.com',
    webhookSigningSecret: `whsec_${Buffer.from('standalone-test-signing-secret!!').toString('base64')}`,
  })
  try {
    const address = await app.listen({host: '127.0.0.1', port: 0})
    await page.goto(`${address}/emails`)
    await createEmailListPageModel(page).rows().row(0).number().locator.click()
    const email = createEmailPageModel(page)
    await expect
      .poll(
        async () => {
          await page.reload()
          return email.details().field('Status').locator.innerText()
        },
        {timeout: 10_000},
      )
      .toBe('Accepted by Resend')
    expect(emailService().sentEmails).toHaveLength(1)
    expect(results()).toHaveLength(0)
  } finally {
    await app.close()
  }
})
