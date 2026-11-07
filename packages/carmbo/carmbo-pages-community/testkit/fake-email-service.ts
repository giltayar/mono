import {
  EmailSendingError,
  type EmailMessage,
  type EmailSendOptions,
  type EmailSendResult,
  type EmailService,
} from '../src/email/email-service.ts'

const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000

interface SendAttempt {
  message: EmailMessage
  options: EmailSendOptions
  timestamp: Date
}
interface SentEmail extends SendAttempt {
  id: string
}
export interface FakeEmailService extends EmailService {
  readonly attempts: SendAttempt[]
  readonly sentEmails: SentEmail[]
  failNextSend(error: Error, options?: {afterAcceptance?: boolean}): void
}

export function createFakeEmailService({
  nowService = () => new Date(),
}: {nowService?: () => Date} = {}): FakeEmailService {
  const attempts: SendAttempt[] = []
  const sentEmails: SentEmail[] = []
  const accepted = new Map<string, SentEmail>()
  const failures: Array<{error: Error; afterAcceptance: boolean}> = []

  return {
    get attempts() {
      return structuredClone(attempts)
    },
    get sentEmails() {
      return structuredClone(sentEmails)
    },
    failNextSend(error, {afterAcceptance = false} = {}) {
      failures.push({error, afterAcceptance})
    },
    async sendEmail(message, options): Promise<EmailSendResult> {
      const attempt = structuredClone({message, options, timestamp: nowService()})
      attempts.push(attempt)

      const failure = failures.shift()
      if (failure && !failure.afterAcceptance) {
        throw failure.error
      }
      const previous = accepted.get(options.idempotencyKey)

      let result: EmailSendResult
      if (
        previous &&
        attempt.timestamp.getTime() - previous.timestamp.getTime() < IDEMPOTENCY_RETENTION_MS
      ) {
        if (JSON.stringify(previous.message) !== JSON.stringify(attempt.message)) {
          throw new EmailSendingError(
            'Idempotency key already used with a different message',
            'invalid_idempotent_request',
            409,
          )
        }
        result = {id: previous.id}
      } else {
        const sent = {...attempt, id: crypto.randomUUID()}

        sentEmails.push(sent)
        accepted.set(options.idempotencyKey, sent)
        result = {id: sent.id}
      }
      if (failure) {
        throw failure.error
      }
      return result
    },
  }
}
