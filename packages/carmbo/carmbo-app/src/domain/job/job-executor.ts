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
    jobLogger.info({jobExecutionId, now: now.toISOString()}, 'execute-jobs-started')
    const sql = globalSql

    const currentJobs = (await sql`
      SELECT
        id, type, payload, number_of_retries, attempts
      FROM
        job
      WHERE
        (scheduled_at IS NULL OR scheduled_at <= ${now}) AND
        finished_at IS NULL AND
        type != '__direct__'
    `) as JobToExecute[]

    jobLogger.info({jobsToExecute: currentJobs.length}, 'found-jobs-to-execute')

    for (const job of currentJobs) {
      const childLogger = jobLogger.child({jobId: job.id, type: job.type})
      childLogger.info({}, 'executing-job-start')

      try {
        await executeJob(job, nowService, globalSql, childLogger)

        childLogger.info({}, 'executing-job-success')
      } catch (err) {
        childLogger.error({err}, 'executing-job-failed')
      }
    }
  })
}

async function executeJob(
  job: JobToExecute,
  nowService: NowService,
  sql: Sql,
  logger: FastifyBaseLogger,
) {
  const attempts = parseInt(job.attempts)
  const numberOfRetries = parseInt(job.numberOfRetries)

  const handler = jobHandlers.get(job.type)

  if (!handler) {
    const now = nowService()
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
    const now = nowService()
    logger.info({}, 'executing-job-handler-success')

    await sql`
      UPDATE job SET ${sql({
        updatedAt: now,
        finishedAt: now,
        ...(result ? {description: result.description} : {}),
      })}
      WHERE id = ${job.id}
    `
  } catch (err) {
    const now = nowService()
    logger.error({err}, 'executing-job-handler-failed')
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

export async function executeDirectJob(
  handler: (options: {
    logger: FastifyBaseLogger
  }) => Promise<{description: string} | void | undefined>,
  nowService: NowService,
  sql: Sql,
  logger: FastifyBaseLogger,
  options: {isTrivial: boolean; description: string | undefined},
) {
  const result = await globalSql`
      INSERT INTO job ${globalSql({
        parentJobId: null,
        type: '__direct__',
        payload: '',
        numberOfRetries: 0,
        scheduledAt: null,
        description: options.description,
        createdAt: nowService(),
        isTrivial: options.isTrivial,
      })}
      RETURNING id
    `
  const jobExecutionId = result[0].id

  logger.info('executing-direct-job-handler')
  try {
    const result = await handler({logger})
    const now = nowService()
    logger.info({}, 'executing-direct-job-handler-success')

    await sql`
      UPDATE job SET ${sql({
        updatedAt: now,
        finishedAt: now,
        ...(result ? {description: result.description} : {}),
      })}
      WHERE id = ${jobExecutionId}
    `
  } catch (err) {
    try {
      const now = nowService()
      logger.error({err}, 'executing-direct-job-handler-failed')

      await sql`
      UPDATE job SET ${sql({
        attempts: 1,
        updatedAt: now,
        finishedAt: now,
        errorMessage: (err as any).message ?? null,
        error: (err as any).stack ?? (typeof err === 'object' ? JSON.stringify(err) : String(err)),
      })}
      WHERE id = ${jobExecutionId}
    `
    } catch (updateErr) {
      logger.error({err: updateErr}, 'failed-to-update-direct-job-after-handler-failed')
    }
    throw err
  }
}

async function garbageCollectJobs(nowService: NowService) {
  const now = nowService()
  const sql = globalSql

  await sql`
    DELETE FROM job
    WHERE finished_at IS NOT NULL AND finished_at < ${new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000, // 30 days old
    )}
    RETURNING id, finished_at
  `
}
