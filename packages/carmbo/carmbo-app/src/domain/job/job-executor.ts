import type {FastifyBaseLogger} from 'fastify'
import {setTimeout} from 'timers/promises'
import type {Sql} from 'postgres'
import {jobHandlers} from './job-handlers.ts'
import type {NowService} from '../../commons/now-service.ts'
import {AsyncLocalStorage} from 'async_hooks'
import {presult, unwrapPresult} from '@giltayar/promise-commons'
import {Mutex} from 'async-mutex'

export async function triggerJobsExecution(nowService: NowService) {
  if (!globalSql || !globalLogger)
    throw new Error('Global helpers for job execution not registered')

  await setTimeout(0)
  const garbagCollectionP = presult(garbageCollectJobs(nowService))

  await executeJobs(nowService).catch((err) => {
    globalLogger.error({err}, 'execute-jobs-under-trigger-failed')
  })

  await unwrapPresult(garbagCollectionP).catch((err) => {
    console.error('******* garbage collection of jobs failed', err)
    globalLogger.error({err}, 'garbage-collect-jobs-under-trigger-failed')
  })
}

export let globalSql: Sql
export let globalLogger: FastifyBaseLogger

export function initializeJobExecutor(sql: Sql, logger: FastifyBaseLogger) {
  globalLogger = logger
  globalSql = sql
}

export type JobExecutionContext = {
  jobId: string
  attemptNumber: number
  sql: Sql
  nowService: () => Date
}

export const jobExecutionAsyncLocalStorage = new AsyncLocalStorage<JobExecutionContext>()

export function TEST_resetJobHandlers() {
  jobHandlers.clear()
}

type JobToExecute = {
  id: number
  type: string
  payload: unknown
  numberOfRetries: string
  attempts: string
}

const jobMutex = new Mutex()

async function executeJobs(nowService: NowService) {
  await jobMutex.runExclusive(async () => {
    const now = nowService()
    const jobExecutionId = crypto.randomUUID()
    const jobLogger = globalLogger.child({jobExecutionId})
    jobLogger.info({jobMutex, now: now.toISOString()}, 'execute-jobs-started')
    const sql = globalSql
    const jobsToExecute = async () =>
      (await sql`
      SELECT
        id, type, payload, number_of_retries, attempts
      FROM
        job
      WHERE
        (scheduled_at IS NULL OR scheduled_at <= ${now}) AND
        finished_at IS NULL
    `) as JobToExecute[]

    jobLogger.info('finding-jobs-to-execute')

    const currentJobs = await jobsToExecute()
    jobLogger.info({jobsToExecute: currentJobs.length}, 'finding-jobs-to-execute')

    for (const job of currentJobs) {
      const childLogger = jobLogger.child({jobId: job.id, type: job.type})
      childLogger.info({}, 'executing-job-start')

      try {
        await executeJob(job, now, globalSql, childLogger)
      } catch (err) {
        childLogger.error({err}, 'executing-job-failed')
      }
    }
  })
}

async function executeJob(job: JobToExecute, now: Date, sql: Sql, logger: FastifyBaseLogger) {
  const attempts = parseInt(job.attempts)
  const numberOfRetries = parseInt(job.numberOfRetries)

  const handler = jobHandlers.get(job.type)

  if (!handler) {
    await sql`
      UPDATE job SET ${sql({
        updatedAt: now,
        finishedAt: now,
        errorMessage: 'no handler found for job type ' + job.type,
      })}
      WHERE id = ${job.id}
    `

    throw new Error(
      `no handler for job type ${job.type}: ${Array.from(jobHandlers.keys()).join(', ')}`,
    )
  }

  logger.info({attempts, numberOfRetries}, 'executing-job-handler')
  try {
    const result = await handler({payload: job.payload, jobId: job.id}, attempts, logger)

    await sql`
      UPDATE job SET ${sql({
        updatedAt: now,
        finishedAt: now,
        ...(result ? {description: result.description} : {}),
      })}
      WHERE id = ${job.id}
    `
  } catch (err) {
    await sql`
      UPDATE job SET ${sql({
        attempts: attempts + 1,
        updatedAt: now,
        finishedAt: attempts >= numberOfRetries ? now : null,
        errorMessage: (err as any).message ?? null,
        error: (err as any).stack ?? (typeof err === 'object' ? JSON.stringify(err) : String(err)),
      })}
      WHERE id = ${job.id}
    `
  }
}

// delete jobs that are more than 7 days old
async function garbageCollectJobs(nowService: NowService) {
  const now = nowService()
  const sql = globalSql

  await sql`
    DELETE FROM job
    WHERE finished_at IS NOT NULL AND finished_at < ${new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000,
    )}
    RETURNING id, finished_at
  `
}
