import type {FastifyBaseLogger} from 'fastify'
import {setTimeout} from 'timers/promises'
import type {Sql} from 'postgres'
import {jobHandlers} from './job-handlers.ts'
import type {NowService} from '../../commons/now-service.ts'

type JobToExecute = {
  id: string
  type: string
  payload: unknown
  numberOfRetries: string
  attempts: string
}

let jobMutex = 0

async function executeJobs(nowService: NowService) {
  ++jobMutex
  const now = nowService()
  const jobExecutionId = crypto.randomUUID()
  const jobLogger = globalLogger.child({jobExecutionId})
  jobLogger.info({jobMutex, now: now.toISOString()}, 'execute-jobs-started')
  if (jobMutex > 1) {
    jobLogger.info({jobMutex}, 'execute-jobs-already-running')
    return
  }

  try {
    jobLogger.info('finding-jobs-to-execute')
    const jobsToExecute = await globalSql<JobToExecute[]>`
      SELECT
        id, type, payload, number_of_retries, attempts
      FROM
        jobs
      WHERE
        scheduled_at IS NULL OR scheduled_at <= ${now}
    `
    jobLogger.info({jobsToExecute: jobsToExecute.length}, 'finding-jobs-to-execute')

    for (const job of jobsToExecute) {
      const childLogger = jobLogger.child({jobId: job.id, type: job.type})
      childLogger.info({}, 'executing-job-start')

      try {
        await executeJob(job, now, globalSql, childLogger)
      } catch (err) {
        childLogger.error({err}, 'executing-job-failed')
      }
    }
  } finally {
    jobLogger.info({jobMutex}, 'ending-jobs-execution')
    --jobMutex
    if (jobMutex > 0) {
      jobLogger.info({jobMutex}, 'retriggering-jobs-execution')
      jobMutex = 0
      triggerJobsExecution(nowService)
    }
  }
}

async function executeJob(job: JobToExecute, now: Date, sql: Sql, logger: FastifyBaseLogger) {
  const attempts = parseInt(job.attempts)
  const numberOfRetries = parseInt(job.numberOfRetries)

  await sql
    .begin(async (sql) => {
      const handler = jobHandlers.get(job.type)

      if (!handler)
        throw new Error(
          `no handler for job type ${job.type}: ${Array.from(jobHandlers.keys()).join(', ')}`,
        )

      logger.info({attempts, numberOfRetries}, 'executing-job-handler')
      await handler(job.payload, attempts, logger, sql)
    })
    .then(
      async () => {
        await sql`DELETE FROM jobs WHERE id = ${job.id}`
      },
      async (err) => {
        if (attempts >= numberOfRetries) {
          logger.error('job-failed-no-retries-left')

          await sql`DELETE FROM jobs WHERE id = ${job.id}`
        } else {
          logger.info({attempts, numberOfRetries}, 'job-scheduled-for-retry')

          await sql`
            UPDATE jobs SET ${sql({attempts: attempts + 1, scheduledAt: null, updatedAt: now})}
          `
        }

        throw err
      },
    )
}

export async function triggerJobsExecution(nowService: NowService) {
  if (!globalSql || !globalLogger)
    throw new Error('Global helpers for job execution not registered')

  await setTimeout(0)
  await executeJobs(nowService).catch((err) => {
    globalLogger.error({err}, 'execute-jobs-under-trigger-failed')
  })
}

let globalSql: Sql
let globalLogger: FastifyBaseLogger

export function registerGlobalHelpersForJobExecution(sql: Sql, logger: FastifyBaseLogger) {
  globalLogger = logger
  globalSql = sql
}

export function TEST_resetJobHandlers() {
  jobHandlers.clear()
}
