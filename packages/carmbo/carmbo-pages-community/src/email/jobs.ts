import type {Sql, TransactionSql} from 'postgres'
import type {NowService} from '@giltayar/carmbo-commons/commons/now-service'
import {registerJobHandler, type JobSubmitter} from '@giltayar/carmbo-pages-job/jobs/handler'
import {recordRegistrationEmailResult} from '../member-model.ts'
import type {EmailService} from './email-service.ts'
import {EMAIL_CORRELATION_TAG, queryEmail, type SendEmailJobPayload} from './model.ts'

// Job IDs restart in every database sharing a Resend account, so the stored per-email UUID is used.
function idempotencyKey(tags: Record<string, string>, jobId: number): string {
  const correlationId = tags[EMAIL_CORRELATION_TAG]
  return correlationId ? `registration-email/${correlationId}` : `sendEmail/${jobId}`
}

// Registers the `sendEmail` handler once per process. The returned submitter is passed to the
// community routes (as `registrationEmail.submitSendEmailJob`), which create the email and its job.
export function registerSendEmailJobHandler({
  sql,
  nowService,
  emailService,
}: {
  sql: Sql
  nowService: NowService
  emailService: EmailService
}): JobSubmitter<SendEmailJobPayload> {
  if (!emailService) throw new Error('Registration email service is required')

  return registerJobHandler<SendEmailJobPayload>(
    'sendEmail',
    nowService,
    {isTrivial: false},
    ({communityNumber, studentNumber}) =>
      `Registration email for community ${communityNumber}, student ${studentNumber}`,
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
        await sql.begin((tx) =>
          recordAcceptance(email.emailNumber, knownProviderId, sentAt, payload, tx),
        )
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
          {idempotencyKey: idempotencyKey(email.tags, jobId)},
        )
        if (!result?.id) throw new Error('Email provider returned no email ID')

        providerId = result.id
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error)
        logger.error({err: error}, 'send-registration-email-failed')
        const acceptedMeanwhile = await sql.begin(async (tx) => {
          const [current] = await tx<{resendEmailId: string | null; deliveredAt: Date | null}[]>`
            SELECT resend_email_id, delivered_at FROM email
            WHERE email_number = ${email.emailNumber} FOR UPDATE
          `
          if (current.resendEmailId) {
            await recordAcceptance(
              email.emailNumber,
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
            await recordRegistrationEmailResult(
              payload.communityNumber,
              payload.studentNumber,
              email.emailNumber,
              {errorText},
              nowService(),
              tx,
            )
          }
          return false
        })
        if (!acceptedMeanwhile) throw error
        logger.info({}, 'registration-email-accepted-by-provider-callback')
        return
      }
      const sentAt = nowService()
      await sql.begin((tx) => recordAcceptance(email.emailNumber, providerId, sentAt, payload, tx))
    },
  )

  async function recordAcceptance(
    emailNumber: number,
    providerId: string,
    sentAt: Date,
    payload: SendEmailJobPayload,
    tx: TransactionSql,
  ) {
    await tx`
      UPDATE email SET resend_email_id = ${providerId},
        delivered_at = COALESCE(delivered_at, ${sentAt}),
        status = CASE WHEN status IN ('success', 'failure') THEN status ELSE 'delivered' END,
        error_text = CASE WHEN status IN ('success', 'failure') THEN error_text ELSE NULL END
      WHERE email_number = ${emailNumber}
    `
    await recordRegistrationEmailResult(
      payload.communityNumber,
      payload.studentNumber,
      emailNumber,
      {sentAt},
      nowService(),
      tx,
    )
  }
}
