import type {FastifyBaseLogger} from 'fastify'
import type {Sql} from 'postgres'

export type JobHandler<TPayload = unknown> = (
  data: {payload: TPayload; jobId: number},
  attempt: number,
  logger: FastifyBaseLogger,
) => Promise<{description: string} | void>

export let globalSql: Sql
export let globalLogger: FastifyBaseLogger

export const jobHandlers = new Map<string, JobHandler<unknown>>()

export function setJobExecutorState(sql: Sql, logger: FastifyBaseLogger): void {
  globalSql = sql
  globalLogger = logger
}
