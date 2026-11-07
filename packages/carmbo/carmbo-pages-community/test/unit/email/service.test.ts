import assert from 'node:assert/strict'
import {test} from 'node:test'
import fastify from 'fastify'
import {
  createResendEmailService,
  EmailSendingError,
  type EmailMessage,
} from '../../../src/email/email-service.ts'
import {createFakeEmailService} from '../../../testkit/fake-email-service.ts'

const message: EmailMessage = {
  from: 'Carmbo <sender@example.com>',
  to: 'delivered@example.com',
  subject: 'Registration',
  html: '<p>Hello Student &amp; Community</p>',
  text: 'Hello Student & Community',
  tags: {email_number: '123'},
}
const options = {idempotencyKey: 'sendEmail/42'}

test('Resend adapter sends the complete payload and idempotency header', async (t) => {
  const app = fastify()
  t.after(() => app.close())
  app.post('/emails', async (request) => {
    assert.equal(request.headers.authorization, 'Bearer test-api-key')
    assert.equal(request.headers['idempotency-key'], options.idempotencyKey)
    assert.deepEqual(request.body, {
      ...message,
      tags: [{name: 'email_number', value: '123'}],
    })
    return {id: 'provider-id'}
  })
  const apiUrl = await app.listen({host: '127.0.0.1', port: 0})
  const service = createResendEmailService({apiKey: 'test-api-key', apiUrl: `${apiUrl}/`})
  assert.deepEqual(await service.sendEmail(message, options), {id: 'provider-id'})
})

for (const status of [401, 409, 429, 500]) {
  test(`Resend adapter propagates provider errors (${status})`, async (t) => {
    const app = fastify()
    t.after(() => app.close())
    app.post('/emails', async (_request, reply) =>
      reply
        .status(status)
        .send({name: 'validation_error', message: `provider error ${status}`, statusCode: status}),
    )
    const apiUrl = await app.listen({host: '127.0.0.1', port: 0})
    const service = createResendEmailService({apiKey: 'test-api-key', apiUrl})
    await assert.rejects(service.sendEmail(message, options), (error) => {
      assert.ok(error instanceof EmailSendingError)
      assert.equal(error.message, `provider error ${status}`)
      assert.equal(error.code, 'validation_error')
      assert.equal(error.statusCode, status)
      return true
    })
  })
}

test('Resend adapter validates configuration', () => {
  assert.throws(() => createResendEmailService({apiKey: ''}))
  assert.throws(() => createResendEmailService({apiKey: 'test', apiUrl: 'invalid'}))
  assert.throws(() => createResendEmailService({apiKey: 'test', apiUrl: ''}))
})

test('fake deduplicates accepted requests but records every attempt', async () => {
  const fake = createFakeEmailService()
  const first = await fake.sendEmail(message, options)
  assert.deepEqual(await fake.sendEmail(message, options), first)
  assert.notDeepEqual(await fake.sendEmail(message, {idempotencyKey: 'sendEmail/43'}), first)
  assert.equal(fake.sentEmails.length, 2)
  assert.equal(fake.attempts.length, 3)
  assert.deepEqual(fake.sentEmails[0].message, message)
  await assert.rejects(fake.sendEmail({...message, subject: 'Changed subject'}, options), {
    code: 'invalid_idempotent_request',
    statusCode: 409,
  })
})

test('fake simulates failures before acceptance and lost responses after acceptance', async () => {
  const fake = createFakeEmailService()
  fake.failNextSend(new EmailSendingError('rate limited', 'rate_limit_exceeded', 429))
  await assert.rejects(fake.sendEmail(message, options), {message: 'rate limited'})
  assert.equal(fake.sentEmails.length, 0)
  fake.failNextSend(new Error('response lost'), {afterAcceptance: true})
  await assert.rejects(fake.sendEmail(message, options), {message: 'response lost'})
  assert.equal(fake.sentEmails.length, 1)
  assert.deepEqual(await fake.sendEmail(message, options), {id: fake.sentEmails[0].id})
  assert.equal(fake.sentEmails.length, 1)
  assert.equal(fake.attempts.length, 3)
})

test('fake expires keys after 24 hours and protects stored payloads from mutation', async () => {
  let now = new Date('2026-01-01T00:00:00Z')
  const fake = createFakeEmailService({nowService: () => now})
  const input = structuredClone(message)
  const first = await fake.sendEmail(input, options)
  input.subject = 'changed'
  fake.sentEmails[0].message.subject = 'also changed'
  assert.equal(fake.sentEmails[0].message.subject, message.subject)
  now = new Date('2026-01-01T23:59:59Z')
  assert.deepEqual(await fake.sendEmail(message, options), first)
  now = new Date('2026-01-02T00:00:00Z')
  assert.notDeepEqual(await fake.sendEmail(message, options), first)
  assert.equal(fake.sentEmails.length, 2)
})
