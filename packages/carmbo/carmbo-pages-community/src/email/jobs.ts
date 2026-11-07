import type {Sql, TransactionSql} from 'postgres'
import type {NowService} from '@giltayar/carmbo-commons/commons/now-service'
import {registerJobHandler} from '@giltayar/carmbo-pages-job/jobs/handler'
import {triggerJobsExecution} from '@giltayar/carmbo-pages-job/jobs/executor'
import {TEST_executeHook} from '@giltayar/carmbo-commons/commons/TEST_hooks'
import {recordRegistrationEmailResult} from '../member-model.ts'
import type {EmailService} from './email-service.ts'
import {queryEmail} from './model.ts'
import {registrationEmailContent} from './registration-template.ts'

type MemberEmail = {
  communityNumber: number
  studentNumber: number
  communityMemberNumber: number
  communityName: string
  studentName: string
  toEmail: string
}
type SendEmailPayload = {communityNumber: number; studentNumber: number}

export interface RegistrationEmailJobs {
  submit(member: MemberEmail, transaction: TransactionSql): Promise<void>
  execute(): Promise<void>
}

export function registerRegistrationEmailJobs({
  sql,
  nowService,
  emailService,
  from,
  language,
}: {
  sql: Sql
  nowService: NowService
  emailService: EmailService
  from: string
  language: 'en' | 'he'
}): RegistrationEmailJobs {
  if (!from.trim()) throw new Error('Registration email sender is required')
  if (!emailService) throw new Error('Registration email service is required')
  const submitJob = registerJobHandler<SendEmailPayload>(
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
      if (email.resendEmailId && email.deliveredAt) {
        const sentAt = email.deliveredAt
        await sql.begin(async (tx) => {
          await recordRegistrationEmailResult(
            payload.communityNumber,
            payload.studentNumber,
            email.emailNumber,
            {sentAt},
            nowService(),
            tx,
          )
        })
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
          {idempotencyKey: `sendEmail/${jobId}`},
        )
        if (!result?.id) throw new Error('Email provider returned no email ID')
        providerId = result.id
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error)
        logger.error({err: error}, 'send-registration-email-failed')
        await sql.begin(async (tx) => {
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
        })
        throw error
      }
      const sentAt = nowService()
      await sql.begin(async (tx) => {
        await tx`
          UPDATE email SET resend_email_id = ${providerId}, delivered_at = ${sentAt},
            status = CASE WHEN status IN ('success', 'failure') THEN status ELSE 'delivered' END,
            error_text = CASE WHEN status IN ('success', 'failure') THEN error_text ELSE NULL END
          WHERE email_number = ${email.emailNumber}
        `
        await recordRegistrationEmailResult(
          payload.communityNumber,
          payload.studentNumber,
          email.emailNumber,
          {sentAt},
          sentAt,
          tx,
        )
      })
    },
  )
  return {
    async submit(member, transaction) {
      const content = registrationEmailContent({...member, language})
      const jobId = await submitJob(
        {communityNumber: member.communityNumber, studentNumber: member.studentNumber},
        {transaction},
      )
      const [email] = await transaction<{emailNumber: number}[]>`
        INSERT INTO email ${transaction({
          purpose: 'registration-email',
          toEmail: member.toEmail,
          fromEmail: from,
          ...content,
          language,
          tags: {job_id: String(jobId)},
          jobId,
          createdAt: nowService(),
        })}
        RETURNING email_number
      `
      await transaction`
        UPDATE community_member SET registration_email_number = ${email.emailNumber}
        WHERE community_member_number = ${member.communityMemberNumber}
      `
      await TEST_executeHook('createRegistrationEmail')
    },
    execute: () => triggerJobsExecution(nowService),
  }
}
