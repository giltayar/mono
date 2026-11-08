import {Resend} from 'resend'
import {z} from 'zod'

// The provider events the webhook subscribes to and the callback routes apply.
export const HANDLED_RESEND_EVENTS = [
  'email.delivered',
  'email.bounced',
  'email.failed',
  'email.suppressed',
] as const

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

export interface ResendEmailService extends EmailService {
  // Pass to the webhook routes: callbacks from this service's webhook are signed with it.
  readonly webhookSigningSecret: string
  // Deletes the webhook registered at initialization. Idempotent.
  dispose(): Promise<void>
}

export async function createResendEmailService({
  apiKey,
  apiUrl,
  webhookUrl,
}: {
  apiKey: string
  apiUrl?: string
  webhookUrl: string
}): Promise<ResendEmailService> {
  const resend = new Resend(
    apiKey,
    apiUrl === undefined ? undefined : {baseUrl: apiUrl.replace(/\/+$/, '')},
  )

  const {data: webhook, error: webhookError} = await resend.webhooks.create({
    endpoint: webhookUrl,
    events: [...HANDLED_RESEND_EVENTS],
  })
  if (webhookError || !webhook) {
    throw new EmailSendingError(
      `Could not register the Resend webhook: ${webhookError?.message ?? 'no data'}`,
      webhookError?.name ?? 'missing_response',
      webhookError?.statusCode ?? null,
    )
  }
  const webhookSigningSecret = z.string().min(1).parse(webhook.signing_secret)
  let webhookId: string | undefined = webhook.id

  return {
    webhookSigningSecret,
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
    async dispose() {
      if (!webhookId) return
      const id = webhookId
      webhookId = undefined
      const {error} = await resend.webhooks.remove(id)
      if (error) {
        throw new EmailSendingError(
          `Could not delete Resend webhook ${id}: ${error.message}`,
          error.name,
          error.statusCode ?? null,
        )
      }
    },
  }
}
