import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {getFixedT} from 'i18next'
import type {EmailMessage} from './email-service.ts'
import {registerEmailLocaleResources} from './locale-resources.ts'

export function registrationEmailContent({
  studentName,
  communityName,
  language,
}: {
  studentName: string
  communityName: string
  language: 'en' | 'he'
}): Pick<EmailMessage, 'subject' | 'html' | 'text'> {
  registerEmailLocaleResources()
  const t = getFixedT(language, 'email')
  const values = {studentName, communityName, interpolation: {escapeValue: false}}
  const subject = t('registration.subject', values)
  const greeting = t('registration.greeting', values)
  const body = t('registration.body', values)
  const closing = t('registration.closing')
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
