import type {FastifyBaseLogger} from 'fastify'
import type {JSONValue} from 'postgres'
import {globalSql, triggerJobsExecution} from './job-executor.ts'

export type JobSubmitter<TPayload = unknown> = (
  payload: TPayload,
  options: {parentJobId?: number; scheduledAt?: Date; retries?: number},
) => Promise<number>

type JobHandler<TPayload = unknown> = (
  data: {payload: TPayload; jobId: number},
  attempt: number,
  logger: FastifyBaseLogger,
) => Promise<{description: string} | void>

export const jobHandlers = new Map<string, JobHandler<unknown>>()

export function registerJobHandler<TPayload extends JSONValue>(
  type: string,
  nowService: () => Date,
  options: {isTrivial: boolean},
  descriptionFn: (payload: TPayload) => string,
  handler: JobHandler<TPayload>,
): JobSubmitter<TPayload> {
  if (jobHandlers.has(type)) throw new Error(`Job Handler for ${type} already registered`)

  jobHandlers.set(type, handler as JobHandler<unknown>)

  return async function (payload: TPayload, {scheduledAt, parentJobId, retries = 3}) {
    const result = await globalSql`
      INSERT INTO job ${globalSql({
        parentJobId: parentJobId ?? null,
        type,
        payload,
        numberOfRetries: retries,
        scheduledAt: scheduledAt ?? null,
        description: descriptionFn(payload),
        isTrivial: options.isTrivial,
        createdAt: nowService(),
      })}
      RETURNING id
    `

    triggerJobsExecution(nowService)

    return parseInt(result[0].id, 10)
  }
}
