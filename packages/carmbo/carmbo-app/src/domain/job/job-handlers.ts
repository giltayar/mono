import type {FastifyBaseLogger} from 'fastify'
import type {JSONValue, Sql} from 'postgres'

export type JobSubmitter<TPayload = unknown> = (
  payload: TPayload,
  sql: Sql,
  options: {scheduledAt?: Date; retries?: number},
) => Promise<void>
type JobHandler<TPayload = unknown> = (
  payload: TPayload,
  attempt: number,
  logger: FastifyBaseLogger,
  sql: Sql,
) => Promise<void>

export const jobHandlers = new Map<string, JobHandler<unknown>>()

export function registerJobHandler<TPayload extends JSONValue>(
  type: string,
  handler: JobHandler<TPayload>,
): JobSubmitter<TPayload> {
  if (jobHandlers.has(type)) throw new Error(`Job Handler for ${type} already registered`)

  jobHandlers.set(type, handler as JobHandler<unknown>)

  return async function (payload: TPayload, sql: Sql, {scheduledAt, retries = 3}) {
    await sql`
      INSERT INTO jobs ${sql({
        type,
        payload,
        numberOfRetries: retries,
        scheduledAt: scheduledAt ?? null,
      })}
    `
  } satisfies JobSubmitter<TPayload>
}
