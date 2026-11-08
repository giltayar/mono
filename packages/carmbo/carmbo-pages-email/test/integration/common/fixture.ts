import type {Sql} from 'postgres'
import type {Email} from '../../../src/emails/model.ts'
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

// Email pages only read these community/student columns, so tests seed them directly instead of
// depending on the community and student packages.
export async function seedMemberLink(
  sql: Sql,
  {
    emailNumber,
    communityName = 'Community',
    firstName = 'Alice',
    lastName = 'Student',
  }: {emailNumber?: number; communityName?: string; firstName?: string; lastName?: string} = {},
): Promise<{communityNumber: number; studentNumber: number; base: string}> {
  return sql.begin(async (tx) => {
    const communityDataId = crypto.randomUUID()
    const communityHistoryId = crypto.randomUUID()
    const [{communityNumber}] = await tx<{communityNumber: number}[]>`
      INSERT INTO community (last_history_id, last_data_id)
      VALUES (${communityHistoryId}, ${communityDataId})
      RETURNING community_number
    `
    await tx`INSERT INTO community_data (data_id, name) VALUES (${communityDataId}, ${communityName})`
    await tx`
      INSERT INTO community_history (id, data_id, community_number, timestamp, operation)
      VALUES (${communityHistoryId}, ${communityDataId}, ${communityNumber}, ${now}, 'create')
    `

    const studentDataId = crypto.randomUUID()
    const studentHistoryId = crypto.randomUUID()
    const [{studentNumber}] = await tx<{studentNumber: number}[]>`
      INSERT INTO student (last_history_id, last_data_id)
      VALUES (${studentHistoryId}, ${studentDataId})
      RETURNING student_number
    `
    await tx`
      INSERT INTO student_name (data_id, item_order, first_name, last_name)
      VALUES (${studentDataId}, 0, ${firstName}, ${lastName})
    `
    await tx`
      INSERT INTO student_history (id, data_id, student_number, timestamp, operation)
      VALUES (${studentHistoryId}, ${studentDataId}, ${studentNumber}, ${now}, 'create')
    `

    await tx`
      INSERT INTO community_member
        (community_number, student_number, last_history_id, registration_email_number)
      VALUES
        (${communityNumber}, ${studentNumber}, ${crypto.randomUUID()}, ${emailNumber ?? null})
    `

    return {
      communityNumber,
      studentNumber,
      base: `/communities/${communityNumber}/members/${studentNumber}`,
    }
  })
}

export async function renameCommunity(
  sql: Sql,
  communityNumber: number,
  name: string,
): Promise<void> {
  await sql.begin(async (tx) => {
    const dataId = crypto.randomUUID()
    const historyId = crypto.randomUUID()
    await tx`INSERT INTO community_data (data_id, name) VALUES (${dataId}, ${name})`
    await tx`
      INSERT INTO community_history (id, data_id, community_number, timestamp, operation)
      VALUES (${historyId}, ${dataId}, ${communityNumber}, ${new Date()}, 'update')
    `
    await tx`
      UPDATE community SET last_history_id = ${historyId}, last_data_id = ${dataId}
      WHERE community_number = ${communityNumber}
    `
  })
}

export async function linkEmailToMember(
  sql: Sql,
  {communityNumber, emailNumber}: {communityNumber: number; emailNumber: number},
): Promise<void> {
  await sql`
    UPDATE community_member SET registration_email_number = ${emailNumber}
    WHERE community_number = ${communityNumber}
  `
}
