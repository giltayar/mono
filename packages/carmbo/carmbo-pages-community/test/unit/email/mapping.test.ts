import assert from 'node:assert/strict'
import {test} from 'node:test'
import {EmailSchema} from '../../../src/email/model.ts'
import {emailToView} from '../../../src/email/view-model-mapping.ts'

const stored = {
  emailNumber: 1,
  purpose: 'registration-email',
  toEmail: 'student@example.com',
  fromEmail: 'Carmbo <sender@example.com>',
  subject: 'Hello',
  html: '<p>Hello</p>',
  text: 'Hello',
  language: 'en',
  tags: {email_number: '1'},
  jobId: 42,
  resendEmailId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  deliveredAt: null,
  successAt: null,
  retryTimestamps: [],
  sendingTimestamps: ['2026-01-01T00:00:01.000Z'],
  status: 'sending',
  errorText: null,
  lastProviderEventAt: null,
  communityNumber: null,
  communityName: null,
  studentNumber: null,
  studentName: null,
}

test('maps nullable email metadata and timestamp arrays to an independent view', () => {
  const email = EmailSchema.parse(stored)
  const view = emailToView(email)
  assert.equal(view.emailNumber, '1')
  assert.equal(view.jobId, '42')
  assert.equal(view.createdAt, '2026-01-01T00:00:00.000Z')
  assert.equal(view.deliveredAt, '')
  assert.equal(view.successAt, '')
  assert.equal(view.communityNumber, '')
  assert.equal(view.studentNumber, '')
  assert.equal(view.errorText, '')
  assert.equal(view.resendEmailId, '')
  assert.equal(view.tags, '{"email_number":"1"}')
  view.sendingTimestamps.push('2026-01-02T00:00:00Z')
  assert.equal(email.sendingTimestamps.length, 1)
})

test('maps completed emails with member links and all timestamps', () => {
  const email = EmailSchema.parse({
    ...stored,
    status: 'success',
    deliveredAt: new Date('2026-01-01T00:00:02Z'),
    successAt: new Date('2026-01-01T00:00:03Z'),
    communityNumber: 3,
    communityName: 'Community',
    studentNumber: 7,
    studentName: 'Student',
    retryTimestamps: ['2026-01-01T00:00:01.000Z'],
  })
  const view = emailToView(email)
  assert.equal(view.communityNumber, '3')
  assert.equal(view.studentNumber, '7')
  assert.equal(view.communityName, 'Community')
  assert.equal(view.studentName, 'Student')
  assert.equal(view.deliveredAt, '2026-01-01T00:00:02.000Z')
  assert.equal(view.successAt, '2026-01-01T00:00:03.000Z')
  assert.deepEqual(view.retryTimestamps, ['2026-01-01T00:00:01.000Z'])
})

test('rejects invalid stored statuses and malformed timestamp JSON', () => {
  assert.throws(() => EmailSchema.parse({...stored, status: 'unknown'}))
  assert.throws(() => EmailSchema.parse({...stored, sendingTimestamps: ['not a date']}))
  assert.throws(() => EmailSchema.parse({...stored, retryTimestamps: 'not an array'}))
})
