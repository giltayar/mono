import type {TransactionSql} from 'postgres'
import {getFixedT} from 'i18next'
import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {TEST_executeHook} from '@giltayar/carmbo-commons/commons/TEST_hooks'
import type {QueueEmail} from '@giltayar/carmbo-pages-email/jobs'
import {registerCommunityLocaleResources} from './locale-resources.ts'

export type RegistrationEmailSettings = {
  queueEmail: QueueEmail
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

export function registrationEmailContent({
  studentName,
  communityName,
  language,
}: {
  studentName: string
  communityName: string
  language: 'en' | 'he'
}): {subject: string; html: string; text: string} {
  registerCommunityLocaleResources()
  const t = getFixedT(language, 'community')
  const values = {studentName, communityName, interpolation: {escapeValue: false}}
  const subject = t('registrationEmail.subject', values)
  const greeting = t('registrationEmail.greeting', values)
  const body = t('registrationEmail.body', values)
  const closing = t('registrationEmail.closing')
  const rendered = html`<html lang=${language} dir=${language === 'he' ? 'rtl' : 'ltr'}>
    <body style="font-family: sans-serif; line-height: 1.6; padding: 24px">
      <h1>${subject}</h1>
      <p>${greeting}</p>
      <p>${body}</p>
      <p>${closing}</p>
    </body>
  </html>`
  return {
    subject,
    html: `<!doctype html>${Array.isArray(rendered) ? rendered.join('') : rendered}`,
    text: `${greeting}\n\n${body}\n\n${closing}`,
  }
}

// Runs inside the member-creation transaction; the caller triggers job execution after commit.
export async function queueRegistrationEmail(
  recipient: RegistrationEmailRecipient,
  {queueEmail, from, language}: RegistrationEmailSettings,
  now: Date,
  tx: TransactionSql,
): Promise<void> {
  const {emailNumber} = await queueEmail(
    {
      purpose: 'registration-email',
      from,
      to: recipient.toEmail,
      ...registrationEmailContent({...recipient, language}),
      language,
      // Also the `sendEmail` job payload, which jobs persisted by earlier versions share.
      payload: {communityNumber: recipient.communityNumber, studentNumber: recipient.studentNumber},
    },
    now,
    tx,
  )
  await tx`
    UPDATE community_member SET registration_email_number = ${emailNumber}
    WHERE community_member_number = ${recipient.communityMemberNumber}
  `
  await TEST_executeHook('createRegistrationEmail')
}
