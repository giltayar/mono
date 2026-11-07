import {randomUUID} from 'node:crypto'
import {expect, test} from '@playwright/test'
import {Resend} from 'resend'
import {createResendEmailService} from '../../src/email/email-service.ts'

test('Resend reports delivery to a special test recipient and deduplicates the same request', async () => {
  const apiKey = process.env.RESEND_TEST_API_KEY ?? process.env.RESEND_API_KEY
  const from = process.env.RESEND_TEST_FROM ?? process.env.RESEND_FROM

  expect(!!apiKey, 'Set RESEND_TEST_API_KEY or RESEND_API_KEY to run this E2E').toBe(true)
  expect(!!from, 'Set RESEND_TEST_FROM or RESEND_FROM to a verified sender').toBe(true)

  if (!apiKey || !from) throw new Error('Missing Resend E2E configuration')

  const service = createResendEmailService({apiKey})
  const run = randomUUID()

  const message = {
    from,
    to: `delivered+${run}@resend.dev`,
    subject: 'Carmbo registration email E2E',
    html: '<p>Hello Test Student, welcome to Test Community.</p>',
    text: 'Hello Test Student, welcome to Test Community.',
    tags: {test_run: run},
  }

  const options = {idempotencyKey: `email-e2e/${run}`}
  const result = await service.sendEmail(message, options)

  expect(result.id).toBeTruthy()
  expect(await service.sendEmail(message, options)).toEqual(result)

  const resend = new Resend(apiKey)
  await expect
    .poll(
      async () => {
        const {data, error} = await resend.emails.get(result.id)
        if (error) throw new Error(`Could not retrieve email ${result.id}: ${error.message}`)
        if (!data) throw new Error(`Resend returned no data for email ${result.id}`)
        return data.last_event
      },
      {
        message: `Email ${result.id} should reach Resend's simulated delivered status`,
        timeout: 20000,
        intervals: [1000, 2000, 3000],
      },
    )
    .toBe('delivered')
})
