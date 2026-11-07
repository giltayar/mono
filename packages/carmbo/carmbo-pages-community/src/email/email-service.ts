import {Resend} from 'resend'
import {z} from 'zod'

export type EmailMessage = {
  from: string
  to: string
  subject: string
  html: string
  text: string
  tags: Record<string, string>
}
export type EmailSendOptions = {idempotencyKey: string}
export type EmailSendResult = {id: string}
export interface EmailService {
  sendEmail(message: EmailMessage, options: EmailSendOptions): Promise<EmailSendResult>
}

export class EmailSendingError extends Error {
  readonly code: string
  readonly statusCode: number | null

  constructor(message: string, code: string, statusCode: number | null) {
    super(message)
    this.name = 'EmailSendingError'
    this.code = code
    this.statusCode = statusCode
  }
}

export function createResendEmailService({
  apiKey,
  apiUrl,
}: {
  apiKey: string
  apiUrl?: string
}): EmailService {
  const key = z.string().trim().min(1).parse(apiKey)
  if (apiUrl !== undefined) z.url().parse(apiUrl)
  const resend = new Resend(
    key,
    apiUrl === undefined ? undefined : {baseUrl: apiUrl.replace(/\/+$/, '')},
  )

  return {
    async sendEmail(message, options) {
      const {tags, ...content} = message

      const {data, error} = await resend.emails.send(
        {...content, tags: Object.entries(tags).map(([name, value]) => ({name, value}))},
        options,
      )

      if (error) {
        throw new EmailSendingError(error.message, error.name, error.statusCode ?? null)
      }

      return data
    },
  }
}
