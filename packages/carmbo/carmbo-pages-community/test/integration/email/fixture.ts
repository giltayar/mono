import type {Sql} from 'postgres'
import type {Email} from '../../../src/email/model.ts'
import {createFakeEmailService, type FakeEmailService} from '../../../testkit/fake-email-service.ts'

export const now = new Date('2026-01-01T12:00:00Z')
let nextJobId = 0

type StoredFields = Omit<
  Email,
  'emailNumber' | 'communityNumber' | 'communityName' | 'studentNumber' | 'studentName'
>

export async function seedEmail(
  sql: Sql,
  overrides: Partial<StoredFields> = {},
  service: FakeEmailService = createFakeEmailService(),
): Promise<number> {
  const jobId = ++nextJobId
  const message = {
    from: overrides.fromEmail ?? 'Carmbo <sender@example.com>',
    to: overrides.toEmail ?? `student${jobId}@example.com`,
    subject: overrides.subject ?? 'Registration email',
    html: overrides.html ?? '<p>Hello Student, welcome to Community.</p>',
    text: overrides.text ?? 'Hello Student, welcome to Community.',
    tags: overrides.tags ?? {job_id: String(jobId)},
  }
  const status = overrides.status ?? 'delivered'
  const result =
    status === 'sending' || status === 'retrying'
      ? undefined
      : await service.sendEmail(message, {idempotencyKey: `sendEmail/${jobId}`})
  const fields: StoredFields = {
    purpose: 'registration-email',
    toEmail: message.to,
    fromEmail: message.from,
    subject: message.subject,
    html: message.html,
    text: message.text,
    tags: message.tags,
    language: 'en',
    jobId,
    resendEmailId: result?.id ?? null,
    createdAt: now,
    deliveredAt: result ? now : null,
    successAt: status === 'success' ? now : null,
    retryTimestamps: [],
    sendingTimestamps: result ? [now.toISOString()] : [],
    status,
    errorText: null,
    lastProviderEventAt: status === 'success' ? now : null,
    ...overrides,
  }
  const [row] = await sql<{emailNumber: number}[]>`
    INSERT INTO email ${sql({
      ...fields,
      tags: sql.json(fields.tags),
      retryTimestamps: sql.json(fields.retryTimestamps),
      sendingTimestamps: sql.json(fields.sendingTimestamps),
    })}
    RETURNING email_number
  `
  return row.emailNumber
}
