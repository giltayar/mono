import assert from 'node:assert/strict'
import test from 'node:test'
import * as emailRoutes from '@giltayar/carmbo-pages-email/routes'
import * as emailWebhookRoutes from '@giltayar/carmbo-pages-email/webhook-routes'
import * as emailService from '@giltayar/carmbo-pages-email/service'
import * as emailJobs from '@giltayar/carmbo-pages-email/jobs'
import * as emailTestkit from '@giltayar/carmbo-pages-email/testkit/email-service'
import * as emailPageModels from '@giltayar/carmbo-pages-email/testkit/page-model/email.model'
import * as templatePageModels from '@giltayar/carmbo-pages-email/testkit/page-model/template.model'
import packageJson from '@giltayar/carmbo-pages-email/package.json' with {type: 'json'}
import fastify from 'fastify'
import {validatorCompiler, serializerCompiler} from 'fastify-type-provider-zod'
import postgres from 'postgres'
import {initializei18next} from '@giltayar/carmbo-commons/commons/i18next-utils'
import {setVersion} from '@giltayar/carmbo-commons/commons/version'
import {setUiConfiguration} from '@giltayar/carmbo-commons/commons/ui-configuration'
import {fastifyRequestContext} from '@fastify/request-context'
import {createHash} from 'node:crypto'

test('publishes the intended package entry points', () => {
  assert.deepEqual(Object.keys(emailRoutes), ['routes'])
  assert.deepEqual(Object.keys(emailWebhookRoutes), ['webhookRoutes'])
  assert.deepEqual(Object.keys(emailService), [
    'EmailSendingError',
    'HANDLED_RESEND_EVENTS',
    'createResendEmailService',
  ])
  assert.deepEqual(Object.keys(emailJobs), ['registerSendEmailJobHandler'])
  assert.deepEqual(Object.keys(emailTestkit), ['createFakeEmailService'])
  assert.deepEqual(Object.keys(emailPageModels), [
    'createEmailListPageModel',
    'createEmailPageModel',
  ])
  assert.deepEqual(Object.keys(templatePageModels), [
    'createTemplateListPageModel',
    'createTemplatePageModel',
  ])
})

test('serves bundled browser assets through published routes without exposing server files', async () => {
  await initializei18next('en')
  setVersion('1.0.0')
  setUiConfiguration('carmel', {withCommunities: true})
  const app = fastify()
  const sql = postgres()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.register(fastifyRequestContext)
  app.register(emailRoutes.routes, {
    prefix: '/emails',
    sql,
    from: 'sender@example.com',
    nowService: () => new Date(),
    emailService: emailTestkit.createFakeEmailService(),
  })
  try {
    assert.equal((await app.inject('/emails/0')).statusCode, 400)
    assert.equal((await app.inject('/emails?page=-1')).statusCode, 400)
    const prefix = `/emails/templates/assets/${packageJson.version}`
    const page = await app.inject('/emails/templates/new')
    assert.equal(page.statusCode, 200)
    for (const [file, type] of [
      ['editor.js', 'application/javascript'],
      ['editor.css', 'text/css'],
    ]) {
      const response = await app.inject(`${prefix}/${file}`)
      assert.equal(response.statusCode, 200)
      assert.match(String(response.headers['content-type']), new RegExp(type))
      assert.equal(response.headers['cache-control'], 'no-cache')
      assert.ok(response.body.length > 100)
      const hash = createHash('sha256').update(response.rawPayload).digest('hex')
      const url = `${prefix}/${file}?v=${hash}`
      assert.ok(page.body.includes(`="${url}"`))
      const fingerprinted = await app.inject(url)
      assert.equal(fingerprinted.statusCode, 200)
      assert.equal(fingerprinted.body, response.body)
      assert.equal(fingerprinted.headers['cache-control'], 'no-cache')
    }
    assert.equal((await app.inject(`${prefix}/editor.tsx`)).statusCode, 404)
    assert.equal((await app.inject(`${prefix}/package.json`)).statusCode, 404)
  } finally {
    await app.close()
    await sql.end()
  }
})

test('does not publish internal modules', async () => {
  for (const specifier of [
    '@giltayar/carmbo-pages-email/model',
    '@giltayar/carmbo-pages-email/src/emails/model.ts',
    '@giltayar/carmbo-pages-email/dist/src/emails/controller.js',
    '@giltayar/carmbo-pages-email/webhook',
    '@giltayar/carmbo-pages-email/testkit',
  ]) {
    await assert.rejects(import(specifier), {code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'})
  }
})
