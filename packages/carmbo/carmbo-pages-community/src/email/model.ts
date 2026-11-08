import type {Sql, TransactionSql} from 'postgres'
import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import {sqlTextSearch} from '@giltayar/carmbo-commons/commons/sql-commons'
import {TEST_executeHook} from '@giltayar/carmbo-commons/commons/TEST_hooks'
import type {JobSubmitter} from '@giltayar/carmbo-pages-job/jobs/handler'
import {registrationEmailContent} from './registration-template.ts'

// Unique across environments sharing a Resend account; links callbacks that arrive before the API response.
export const EMAIL_CORRELATION_TAG = 'carmbo_email_id'

export type SendEmailJobPayload = {communityNumber: number; studentNumber: number}

export type RegistrationEmailSettings = {
  submitSendEmailJob: JobSubmitter<SendEmailJobPayload>
  from: string
  language: 'en' | 'he'
}

export type RegistrationEmailRecipient = {
  communityNumber: number
  studentNumber: number
  communityMemberNumber: number
  communityName: string
  studentName: string
  toEmail: string
}

// Runs inside the member-creation transaction; the caller triggers job execution after commit.
export async function sendRegistrationEmail(
  recipient: RegistrationEmailRecipient,
  {submitSendEmailJob, from, language}: RegistrationEmailSettings,
  now: Date,
  tx: TransactionSql,
): Promise<void> {
  const content = registrationEmailContent({...recipient, language})
  const jobId = await submitSendEmailJob(
    {communityNumber: recipient.communityNumber, studentNumber: recipient.studentNumber},
    {transaction: tx},
  )
  const [email] = await tx<{emailNumber: number}[]>`
    INSERT INTO email ${tx({
      purpose: 'registration-email',
      toEmail: recipient.toEmail,
      fromEmail: from,
      ...content,
      language,
      tags: {job_id: String(jobId), [EMAIL_CORRELATION_TAG]: randomUUID()},
      jobId,
      createdAt: now,
    })}
    RETURNING email_number
  `
  await tx`
    UPDATE community_member SET registration_email_number = ${email.emailNumber}
    WHERE community_member_number = ${recipient.communityMemberNumber}
  `
  await TEST_executeHook('createRegistrationEmail')
}

export const EmailSchema = z.object({
  emailNumber: z.number().int().positive(),
  purpose: z.literal('registration-email'),
  toEmail: z.email(),
  fromEmail: z.string().min(1),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
  language: z.string(),
  tags: z.record(z.string(), z.string()),
  jobId: z.number().int().positive(),
  resendEmailId: z.string().nullable(),
  createdAt: z.date(),
  deliveredAt: z.date().nullable(),
  successAt: z.date().nullable(),
  retryTimestamps: z.array(z.iso.datetime({offset: true})),
  sendingTimestamps: z.array(z.iso.datetime({offset: true})),
  status: z.enum(['sending', 'retrying', 'delivered', 'success', 'failure']),
  errorText: z.string().nullable(),
  lastProviderEventAt: z.date().nullable(),
  communityNumber: z.number().int().positive().nullable(),
  communityName: z.string().nullable(),
  studentNumber: z.number().int().positive().nullable(),
  studentName: z.string().nullable(),
})
export type Email = z.infer<typeof EmailSchema>

function selectEmails(sql: Sql) {
  // Text avoids the camel-case JSON key transform, preserving the exact tags sent to Resend.
  return sql`
    SELECT e.*, e.tags::text AS raw_tags, member.community_number, member.community_name,
      member.student_number, member.student_name
    FROM email e
    LEFT JOIN LATERAL (
      SELECT m.community_number, cd.name AS community_name, m.student_number,
        concat_ws(' ', sn.first_name, sn.last_name) AS student_name
      FROM community_member m
      LEFT JOIN community c ON c.community_number = m.community_number
      LEFT JOIN community_history ch ON ch.id = c.last_history_id
      LEFT JOIN community_data cd ON cd.data_id = ch.data_id
      LEFT JOIN student s ON s.student_number = m.student_number
      LEFT JOIN student_history sh ON sh.id = s.last_history_id
      LEFT JOIN student_name sn ON sn.data_id = sh.data_id AND sn.item_order = 0
      WHERE m.registration_email_number = e.email_number
      ORDER BY m.community_member_number
      LIMIT 1
    ) member ON true
  `
}

export async function listEmails(
  {query, page}: {query: string; page: number},
  sql: Sql,
): Promise<Email[]> {
  z.number().int().nonnegative().parse(page)
  const rows = await sql`
    ${selectEmails(sql)}
    ${
      query.trim()
        ? sql`WHERE concat_ws(' ', e.to_email, member.community_name, member.student_name)
          ${sqlTextSearch(query.trim(), sql)}`
        : sql``
    }
    ORDER BY e.created_at DESC, e.email_number DESC
    LIMIT 50 OFFSET ${page * 50}
  `
  return rows.map(rowToEmail)
}

export async function queryEmail(emailNumber: number, sql: Sql): Promise<Email | undefined> {
  const [row] = await sql`${selectEmails(sql)} WHERE e.email_number = ${emailNumber}`

  return row ? rowToEmail(row) : undefined
}

function rowToEmail(row: Record<string, unknown>): Email {
  return EmailSchema.parse({...row, tags: JSON.parse(z.string().parse(row.rawTags))})
}
