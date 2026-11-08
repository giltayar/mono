import type {Sql} from 'postgres'
import {z} from 'zod'
import {HANDLED_RESEND_EVENTS} from './email-service.ts'
import {EMAIL_CORRELATION_TAG} from './model.ts'

type HandledEventType = (typeof HANDLED_RESEND_EVENTS)[number]

const TagsSchema = z.union([
  z.record(z.string(), z.string()),
  z
    .array(z.object({name: z.string(), value: z.string()}))
    .transform((tags) => Object.fromEntries(tags.map(({name, value}) => [name, value]))),
])

const ResendEmailEventSchema = z.object({
  type: z.enum(HANDLED_RESEND_EVENTS),
  created_at: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  data: z.object({
    email_id: z.string().min(1),
    tags: TagsSchema.optional(),
    bounce: z.object({message: z.string()}).optional(),
    failed: z.object({reason: z.string()}).optional(),
    suppressed: z.object({message: z.string()}).optional(),
  }),
})

export type ResendEmailEvent = {
  type: HandledEventType
  occurredAt: Date
  providerEmailId: string
  correlationId: string | null
  errorText: string | null
}

export type ResendEventOutcome = 'applied' | 'stale' | 'unknown-email' | 'unsupported'

export function parseResendEvent(event: unknown): ResendEmailEvent | {unsupported: string} {
  const {type} = z.object({type: z.string()}).parse(event)
  if (!HANDLED_RESEND_EVENTS.some((handled) => handled === type)) return {unsupported: type}

  const parsed = ResendEmailEventSchema.parse(event)
  const {data} = parsed
  return {
    type: parsed.type,
    occurredAt: new Date(parsed.created_at),
    providerEmailId: data.email_id,
    correlationId: data.tags?.[EMAIL_CORRELATION_TAG] ?? null,
    errorText:
      parsed.type === 'email.bounced'
        ? `Bounced: ${data.bounce?.message ?? 'no details'}`
        : parsed.type === 'email.failed'
          ? `Failed: ${data.failed?.reason ?? 'no details'}`
          : parsed.type === 'email.suppressed'
            ? `Suppressed: ${data.suppressed?.message ?? 'no details'}`
            : null,
  }
}

export async function applyResendEvent(
  event: ResendEmailEvent,
  sql: Sql,
): Promise<{outcome: Exclude<ResendEventOutcome, 'unsupported'>; emailNumber: number | null}> {
  const delivered = event.type === 'email.delivered'
  const matches = sql`
    (resend_email_id = ${event.providerEmailId} OR (
      ${event.correlationId}::text IS NOT NULL
      AND tags->>${EMAIL_CORRELATION_TAG} = ${event.correlationId}
      AND resend_email_id IS NULL
    ))
  `
  const [applied] = await sql<{emailNumber: number}[]>`
    UPDATE email SET
      resend_email_id = ${event.providerEmailId},
      status = ${delivered ? 'success' : 'failure'},
      success_at = ${delivered ? sql`${event.occurredAt}` : sql`success_at`},
      error_text = ${event.errorText},
      last_provider_event_at = ${event.occurredAt}
    WHERE ${matches}
      AND (last_provider_event_at IS NULL OR last_provider_event_at < ${event.occurredAt})
    RETURNING email_number
  `
  if (applied) return {outcome: 'applied', emailNumber: applied.emailNumber}

  const [existing] = await sql<{emailNumber: number}[]>`
    SELECT email_number FROM email WHERE ${matches}
  `
  return existing
    ? {outcome: 'stale', emailNumber: existing.emailNumber}
    : {outcome: 'unknown-email', emailNumber: null}
}
