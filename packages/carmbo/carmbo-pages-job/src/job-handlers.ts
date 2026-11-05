import type {JSONValue, TransactionSql} from 'postgres'
import {triggerJobsExecution} from './job-executor.ts'
import {globalSql, jobHandlers, type JobHandler} from './job-state.ts'

export type {JobHandler} from './job-state.ts'

export type JobSubmissionOptions = {
  parentJobId?: number
  scheduledAt?: Date
  retries?: number
  transaction?: TransactionSql
}

export type JobSubmitter<TPayload = unknown> = (
  payload: TPayload,
  options: JobSubmissionOptions,
) => Promise<number>

export function registerJobHandler<TPayload extends JSONValue>(
  type: string,
  nowService: () => Date,
  options: {isTrivial: boolean},
  descriptionFn: (payload: TPayload) => string,
  handler: JobHandler<TPayload>,
): JobSubmitter<TPayload> {
  if (jobHandlers.has(type)) throw new Error(`Job Handler for ${type} already registered`)

  jobHandlers.set(type, handler as JobHandler<unknown>)

  return async function (payload: TPayload, {scheduledAt, parentJobId, retries = 3, transaction}) {
    const sql = transaction ?? globalSql
    const result = await sql`
      INSERT INTO job ${sql({
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

    if (!transaction) triggerJobsExecution(nowService)

    return parseInt(result[0].id, 10)
  }
}
