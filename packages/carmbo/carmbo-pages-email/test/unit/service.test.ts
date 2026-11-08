import assert from 'node:assert/strict'
import {test} from 'node:test'
import fastify, {type FastifyInstance} from 'fastify'
import {
  createResendEmailService,
  EmailSendingError,
  HANDLED_RESEND_EVENTS,
  type EmailMessage,
} from '../../src/emails/email-service.ts'
import {createFakeEmailService} from '../../testkit/fake-email-service.ts'

const message: EmailMessage = {
  from: 'Carmbo <sender@example.com>',
  to: 'delivered@example.com',
  subject: 'Registration',
  html: '<p>Hello Student &amp; Community</p>',
  text: 'Hello Student & Community',
  tags: {email_number: '123'},
}
const options = {idempotencyKey: 'sendEmail/42'}
const webhookUrl = 'https://callbacks.example.test/api/emails/resend/webhook'

// The SDK sends DELETE requests with a JSON content type and an empty body, which Resend accepts.
function acceptEmptyJsonBodies(app: FastifyInstance) {
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', {parseAs: 'string'}, (_request, body, done) =>
    done(null, body ? JSON.parse(String(body)) : undefined),
  )
}

function mockWebhookApi(app: FastifyInstance, existing: {id: string; endpoint: string}[]) {
  acceptEmptyJsonBodies(app)
  const created: unknown[] = []
  const removed: string[] = []
  // Pages of two, like Resend's cursor pagination, to exercise `after`.
  app.get<{Querystring: {after?: string}}>('/webhooks', async (request) => {
    const start = request.query.after
      ? existing.findIndex((webhook) => webhook.id === request.query.after) + 1
      : 0
    const page = existing.slice(start, start + 2)
    return {
      object: 'list',
      has_more: start + 2 < existing.length,
      data: page.map((webhook) => ({
        ...webhook,
        created_at: '2026-11-08T00:00:00Z',
        status: 'enabled',
        events: [...HANDLED_RESEND_EVENTS],
      })),
    }
  })
  app.post('/webhooks', async (request) => {
    created.push(request.body)
    return {object: 'webhook', id: 'webhook-id', signing_secret: 'whsec_c2VjcmV0'}
  })
  app.delete<{Params: {id: string}}>('/webhooks/:id', async (request) => {
    removed.push(request.params.id)
    return {object: 'webhook', id: request.params.id, deleted: true}
  })
  return {created, removed}
}

async function serviceFor(app: FastifyInstance) {
  const apiUrl = await app.listen({host: '127.0.0.1', port: 0})
  return createResendEmailService({apiKey: 'test-api-key', apiUrl, webhookUrl})
}

test('Resend adapter sends the complete payload and idempotency header', async (t) => {
  const app = fastify()
  t.after(() => app.close())
  const webhooks = mockWebhookApi(app, [])
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
  const service = await createResendEmailService({
    apiKey: 'test-api-key',
    apiUrl: `${apiUrl}/`,
    webhookUrl,
  })
  assert.deepEqual(webhooks.created, [{endpoint: webhookUrl, events: [...HANDLED_RESEND_EVENTS]}])
  assert.equal(service.webhookSigningSecret, 'whsec_c2VjcmV0')
  assert.deepEqual(await service.sendEmail(message, options), {id: 'provider-id'})
})

test('dispose deletes the registered webhook exactly once', async (t) => {
  const app = fastify()
  t.after(() => app.close())
  const webhooks = mockWebhookApi(app, [])
  const service = await serviceFor(app)
  await service.dispose()
  await service.dispose()
  assert.deepEqual(webhooks.removed, ['webhook-id'])
})

test('initialization deletes leftover webhooks for the same URL, and only those', async (t) => {
  const app = fastify()
  t.after(() => app.close())
  const webhooks = mockWebhookApi(app, [
    {id: 'leftover-1', endpoint: webhookUrl},
    {id: 'other-app', endpoint: 'https://other.example.test/api/emails/resend/webhook'},
    {id: 'dev-tunnel', endpoint: 'https://abc.trycloudflare.com/api/emails/resend/webhook'},
    {id: 'leftover-2', endpoint: webhookUrl},
    {id: 'similar-path', endpoint: `${webhookUrl}/extra`},
  ])
  await serviceFor(app)
  assert.deepEqual(webhooks.removed, ['leftover-1', 'leftover-2'])
  assert.equal(webhooks.created.length, 1)
})

test('webhook registration and deletion failures are reported', async (t) => {
  const app = fastify()
  t.after(() => app.close())
  acceptEmptyJsonBodies(app)
  let failRemoval = false
  app.get('/webhooks', async () => ({object: 'list', has_more: false, data: []}))
  app.post('/webhooks', async (_request, reply) =>
    failRemoval
      ? {object: 'webhook', id: 'webhook-id', signing_secret: 'whsec_c2VjcmV0'}
      : reply
          .status(403)
          .send({name: 'restricted_api_key', message: 'Sending only', statusCode: 403}),
  )
  app.delete('/webhooks/:id', async (_request, reply) =>
    reply.status(500).send({name: 'internal_server_error', message: 'Down', statusCode: 500}),
  )
  const apiUrl = await app.listen({host: '127.0.0.1', port: 0})
  const create = () => createResendEmailService({apiKey: 'test-api-key', apiUrl, webhookUrl})
  await assert.rejects(create(), {
    name: 'EmailSendingError',
    message: 'Could not register the Resend webhook: Sending only',
    code: 'restricted_api_key',
    statusCode: 403,
  })

  failRemoval = true
  const service = await create()
  await assert.rejects(service.dispose(), {
    message: 'Could not delete Resend webhook webhook-id: Down',
    statusCode: 500,
  })
})

for (const status of [401, 409, 429, 500]) {
  test(`Resend adapter propagates provider errors (${status})`, async (t) => {
    const app = fastify()
    t.after(() => app.close())
    mockWebhookApi(app, [])
    app.post('/emails', async (_request, reply) =>
      reply
        .status(status)
        .send({name: 'validation_error', message: `provider error ${status}`, statusCode: status}),
    )
    const service = await serviceFor(app)
    await assert.rejects(service.sendEmail(message, options), (error) => {
      assert.ok(error instanceof EmailSendingError)
      assert.equal(error.message, `provider error ${status}`)
      assert.equal(error.code, 'validation_error')
      assert.equal(error.statusCode, status)
      return true
    })
  })
}

test('Resend adapter validates configuration before calling the API', async () => {
  await assert.rejects(createResendEmailService({apiKey: '', webhookUrl}))
  await assert.rejects(createResendEmailService({apiKey: 'test', apiUrl: 'invalid', webhookUrl}))
  await assert.rejects(createResendEmailService({apiKey: 'test', apiUrl: '', webhookUrl}))
  await assert.rejects(createResendEmailService({apiKey: 'test', webhookUrl: ''}))
  await assert.rejects(
    createResendEmailService({apiKey: 'test', webhookUrl: 'http://insecure.example.test/hook'}),
  )
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
