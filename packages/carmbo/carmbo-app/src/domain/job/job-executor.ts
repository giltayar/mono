import type {FastifyBaseLogger} from 'fastify'
import type {Sql} from 'postgres'
import {jobHandlers} from './job-handlers.ts'

type JobToExecute = {
  id: string
  type: string
  payload: unknown
  numberOfRetries: string
  attempts: string
}

let jobMutex = 0

async function executeJobs() {
  if (jobMutex) return

  try {
    jobMutex = 1
    const jobsToExecute = await globalSql<JobToExecute[]>`
      SELECT
        id, type, payload, number_of_retries, attempts
      FROM
        jobs
      WHERE
        scheduled_at IS NULL OR scheduled_at <= NOW()
    `

    for (const job of jobsToExecute) {
      const childLogger = globalLogger.child({jobId: job.id, type: job.type})
      childLogger.info({}, 'executing-job-start')

      try {
        await executeJob(job, globalSql, childLogger)
      } catch (err) {
        childLogger.error({err}, 'executing-job-failed')
      }
    }

    if (jobsToExecute.length > 0) {
      triggerJobsExecution()
    }
  } finally {
    jobMutex = 0
  }
}

async function executeJob(job: JobToExecute, sql: Sql, logger: FastifyBaseLogger) {
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
            UPDATE jobs SET ${sql({attempts: attempts + 1, scheduledAt: null, updatedAt: new Date()})}
          `
        }

        throw err
      },
    )
}

export function triggerJobsExecution() {
  if (!globalSql || !globalLogger)
    throw new Error('Global helpers for job execution not registered')
  setTimeout(
    () =>
      executeJobs().catch((err) => {
        globalLogger.error({err}, 'execute-jobs-under-trigger-failed')
      }),
    0,
  )
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
