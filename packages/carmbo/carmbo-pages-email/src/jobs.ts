import type {JSONValue, Sql, TransactionSql} from 'postgres'
import type {NowService} from '@giltayar/carmbo-commons/commons/now-service'
import {registerJobHandler} from '@giltayar/carmbo-pages-job/jobs/handler'
import type {EmailService} from './email-service.ts'
import {
  EMAIL_CORRELATION_TAG,
  insertEmail,
  queryEmail,
  type EmailPurpose,
  type NewEmail,
} from './model.ts'

export type {EmailPurpose} from './model.ts'

export type EmailJobPayload = {[key: string]: JSONValue}

export type EmailToQueue = NewEmail & {
  // Opaque caller data, stored as the job payload and passed back to the purpose's result handler.
  payload: EmailJobPayload
}

// Saves the email and submits its send job in the caller's transaction. Execution starts only when
// the host triggers job execution after commit.
export type QueueEmail = (
  email: EmailToQueue,
  now: Date,
  tx: TransactionSql,
) => Promise<{emailNumber: number; jobId: number}>

export type EmailResult = {sentAt: Date} | {errorText: string}

// Called once, in the transaction recording the outcome: after provider acceptance, or after the
// last attempt fails.
export type EmailResultHandler = (result: {
  emailNumber: number
  payload: EmailJobPayload
  result: EmailResult
  now: Date
  tx: TransactionSql
}) => Promise<void>

export type EmailResultHandlers = Partial<Record<EmailPurpose, EmailResultHandler>>

// Job IDs restart in every database sharing a Resend account, so the stored per-email UUID is used.
function idempotencyKey(
  {purpose, tags}: {purpose: EmailPurpose; tags: Record<string, string>},
  jobId: number,
): string {
  const correlationId = tags[EMAIL_CORRELATION_TAG]
  return correlationId ? `${purpose}/${correlationId}` : `sendEmail/${jobId}`
}

function describeJob(payload: EmailJobPayload): string {
  const details = Object.entries(payload)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ')
  return details ? `Send email (${details})` : 'Send email'
}

// Registers the `sendEmail` handler once per process and returns the function that queues emails.
export function registerSendEmailJobHandler({
  sql,
  nowService,
  emailService,
  resultHandlers = {},
}: {
  sql: Sql
  nowService: NowService
  emailService: EmailService
  resultHandlers?: EmailResultHandlers
}): QueueEmail {
  if (!emailService) throw new Error('Email service is required')

  const submitSendEmailJob = registerJobHandler<EmailJobPayload>(
    'sendEmail',
    nowService,
    {isTrivial: false},
    describeJob,
    async ({payload, jobId, isLastAttempt}, attempt, logger) => {
      const [row] = await sql<{emailNumber: number}[]>`
        SELECT email_number FROM email WHERE job_id = ${jobId}
      `
      if (!row) throw new Error(`Email record not found for job ${jobId}`)

      const email = await queryEmail(row.emailNumber, sql)
      if (!email) throw new Error(`Email ${row.emailNumber} not found`)

      // A provider ID (from the API or a delivery callback) proves acceptance: never send again.
      const knownProviderId = email.resendEmailId
      if (knownProviderId) {
        const sentAt = email.deliveredAt ?? nowService()
        await sql.begin((tx) => recordAcceptance(email, knownProviderId, sentAt, payload, tx))
        return
      }

      const startedAt = nowService().toISOString()
      await sql`
        UPDATE email SET
          sending_timestamps = sending_timestamps || ${sql.json([startedAt])},
          retry_timestamps = retry_timestamps ||
            ${sql.json(attempt > 0 ? [startedAt] : [])}
        WHERE email_number = ${email.emailNumber}
      `
      let providerId: string
      try {
        const result = await emailService.sendEmail(
          {
            from: email.fromEmail,
            to: email.toEmail,
            subject: email.subject,
            html: email.html,
            text: email.text,
            tags: email.tags,
          },
          {idempotencyKey: idempotencyKey(email, jobId)},
        )
        if (!result?.id) throw new Error('Email provider returned no email ID')

        providerId = result.id
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error)
        logger.error({err: error}, 'send-email-failed')
        const acceptedMeanwhile = await sql.begin(async (tx) => {
          const [current] = await tx<{resendEmailId: string | null; deliveredAt: Date | null}[]>`
            SELECT resend_email_id, delivered_at FROM email
            WHERE email_number = ${email.emailNumber} FOR UPDATE
          `
          if (current.resendEmailId) {
            await recordAcceptance(
              email,
              current.resendEmailId,
              current.deliveredAt ?? nowService(),
              payload,
              tx,
            )
            return true
          }
          await tx`
            UPDATE email SET status = ${isLastAttempt ? 'failure' : 'retrying'},
              error_text = ${errorText}
            WHERE email_number = ${email.emailNumber}
          `
          if (isLastAttempt) {
            await resultHandlers[email.purpose]?.({
              emailNumber: email.emailNumber,
              payload,
              result: {errorText},
              now: nowService(),
              tx,
            })
          }
          return false
        })
        if (!acceptedMeanwhile) throw error
        logger.info({}, 'email-accepted-by-provider-callback')
        return
      }
      const sentAt = nowService()
      await sql.begin((tx) => recordAcceptance(email, providerId, sentAt, payload, tx))
    },
  )

  return async function queueEmail({payload, ...email}, now, tx) {
    const jobId = await submitSendEmailJob(payload, {transaction: tx})
    const emailNumber = await insertEmail(email, jobId, now, tx)

    return {emailNumber, jobId}
  }

  async function recordAcceptance(
    {emailNumber, purpose}: {emailNumber: number; purpose: EmailPurpose},
    providerId: string,
    sentAt: Date,
    payload: EmailJobPayload,
    tx: TransactionSql,
  ) {
    await tx`
      UPDATE email SET resend_email_id = ${providerId},
        delivered_at = COALESCE(delivered_at, ${sentAt}),
        status = CASE WHEN status IN ('success', 'failure') THEN status ELSE 'delivered' END,
        error_text = CASE WHEN status IN ('success', 'failure') THEN error_text ELSE NULL END
      WHERE email_number = ${emailNumber}
    `
    await resultHandlers[purpose]?.({
      emailNumber,
      payload,
      result: {sentAt},
      now: nowService(),
      tx,
    })
  }
}
