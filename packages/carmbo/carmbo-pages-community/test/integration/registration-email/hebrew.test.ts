import {expect, test} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createMemberFixture} from '../common/member-fixture.ts'
import {addMember, DEFAULT_MEMBER_ROLES} from '../../../src/member-model.ts'

const {sql, registrationEmail, executeJobs, emailService} = setup(import.meta.url, {
  language: 'he',
})

test('new members receive an immutable Hebrew registration email with RTL content', async () => {
  const now = new Date()
  const {communityNumber, studentNumber} = await createMemberFixture(
    sql(),
    now,
    'תלמידה',
    'student@example.com',
  )
  await addMember(
    communityNumber,
    studentNumber,
    now,
    sql(),
    DEFAULT_MEMBER_ROLES,
    registrationEmail(),
  )
  await executeJobs()
  const database = sql()
  const [email] = await database<{language: string; subject: string; text: string; html: string}[]>`
    SELECT language, subject, text, html FROM email
  `
  expect(email.language).toBe('he')
  expect(email.subject).toBe('ברוכים הבאים לקהילת Community')
  expect(email.text).toContain('שלום תלמידה Student,')
  expect(email.html).toContain('dir="rtl"')
  expect(emailService().sentEmails[0].message.html).toBe(email.html)
})
