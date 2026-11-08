import assert from 'node:assert/strict'
import test from 'node:test'
import * as emailRoutes from '@giltayar/carmbo-pages-email/routes'
import * as emailWebhookRoutes from '@giltayar/carmbo-pages-email/webhook-routes'
import * as emailService from '@giltayar/carmbo-pages-email/service'
import * as emailJobs from '@giltayar/carmbo-pages-email/jobs'
import * as emailTestkit from '@giltayar/carmbo-pages-email/testkit/email-service'
import * as emailPageModels from '@giltayar/carmbo-pages-email/testkit/page-model/email.model'

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
})

test('does not publish internal modules', async () => {
  for (const specifier of [
    '@giltayar/carmbo-pages-email/model',
    '@giltayar/carmbo-pages-email/src/model.ts',
    '@giltayar/carmbo-pages-email/dist/src/controller.js',
    '@giltayar/carmbo-pages-email/webhook',
    '@giltayar/carmbo-pages-email/testkit',
  ]) {
    await assert.rejects(import(specifier), {code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'})
  }
})
