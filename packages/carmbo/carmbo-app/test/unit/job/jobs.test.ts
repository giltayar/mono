import {test, describe, before, after, beforeEach} from 'node:test'
import assert from 'node:assert'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import postgres from 'postgres'
import type {Sql} from 'postgres'
import retry from 'p-retry'
import {initializeJobExecutor, triggerJobsExecution} from '../../../src/domain/job/job-executor.ts'
import {registerJobHandler, jobHandlers} from '../../../src/domain/job/job-handlers.ts'
import type {FastifyBaseLogger} from 'fastify'
import {setTimeout} from 'node:timers/promises'
import {migrate} from '../../../src/sql/migration.ts'

// Create a simple logger for testing
function createTestLogger(): FastifyBaseLogger {
  const logs: Array<{level: string; message: string; data?: unknown}> = []

  const logger = {
    logs,
    info(data: unknown, message?: string) {
      logs.push({level: 'info', message: message || '', data})
    },
    error(data: unknown, message?: string) {
      logs.push({level: 'error', message: message || '', data})
    },
    child() {
      return logger
    },
  } as unknown as FastifyBaseLogger

  return logger
}

const logger = createTestLogger()
const nowService = () => new Date()

describe('Job Executor', () => {
  let sql: Sql
  let teardown: (() => Promise<void>) | undefined
  let findAddress: (
    service: string,
    port: number,
    options?: {healthCheck?: (address: string) => Promise<void>},
  ) => Promise<string>

  before(async () => {
    const result = await runDockerCompose(new URL('./docker-compose.yaml', import.meta.url), {
      variation: import.meta.url,
    })
    findAddress = result.findAddress
    teardown = result.teardown

    const host = await findAddress('job-test-postgres', 5432, {
      healthCheck: async (address: string) => {
        const [h, p] = address.split(':')
        const testSql = postgres({
          host: h,
          port: parseInt(p, 10),
          database: 'job_test',
          user: 'test_user',
          password: 'test_password',
        })
        await testSql`SELECT 1`
        await testSql.end()
      },
    })

    const [h, p] = host.split(':')
    sql = postgres({
      host: h,
      port: parseInt(p, 10),
      database: 'job_test',
      user: 'test_user',
      password: 'test_password',
      transform: {...postgres.camel},
    })

    await migrate({sql, path: new URL('../../../src/sql', import.meta.url)})

    initializeJobExecutor(sql, logger)
  })

  after(() => teardown?.())

  beforeEach(async () => {
    // Clear the jobs table and reset job handlers
    await sql`TRUNCATE TABLE job RESTART IDENTITY CASCADE`
    jobHandlers.clear()
  })

  test('should execute two jobs successfully and delete them from the database', async () => {
    const executedJobs: Array<{
      data: {payload: unknown; jobId: number}
      attempt: number
    }> = []

    const submitJob = registerJobHandler('test-job', nowService, async (data, attempt) => {
      executedJobs.push({data, attempt})

      return {description: `job ${(data.payload as any)?.message}`}
    })

    await submitJob({message: 'Hello World'}, {retries: 3})
    await submitJob({message: 'Goodbye World'}, {retries: 3})

    triggerJobsExecution(() => new Date())

    const completedJobs = await waitForJobsToComplete(sql)

    assert.deepStrictEqual(executedJobs, [
      {data: {payload: {message: 'Hello World'}, jobId: 1}, attempt: 0},
      {data: {payload: {message: 'Goodbye World'}, jobId: 2}, attempt: 0},
    ])

    assert.partialDeepStrictEqual(completedJobs, [
      {id: 1, error: null, errorMessage: null, parentJobId: null, description: 'job Hello World'},
      {id: 2, error: null, errorMessage: null, parentJobId: null, description: 'job Goodbye World'},
    ])
  })

  test('should execute a job and a sub job successfully and delete them from the database', async () => {
    const executedJobs: Array<{
      data: {payload: unknown; jobId: number}
      attempt: number
    }> = []

    let once = false

    const submitJob = registerJobHandler('test-job', nowService, async (data, attempt) => {
      executedJobs.push({data, attempt})
      if (!once) {
        await submitJob({message: 'Sub Job'}, {parentJobId: data.jobId, retries: 3})
        once = true
      }

      return {description: ''}
    })

    await submitJob({message: 'Hello World'}, {retries: 3})

    triggerJobsExecution(() => new Date())

    const completedJobs = await waitForJobsToComplete(sql)

    assert.deepStrictEqual(executedJobs, [
      {data: {payload: {message: 'Hello World'}, jobId: 1}, attempt: 0},
      {data: {payload: {message: 'Sub Job'}, jobId: 2}, attempt: 0},
    ])
    assert.partialDeepStrictEqual(completedJobs, [
      {id: 1, error: null, errorMessage: null, parentJobId: null},
      {id: 2, error: null, errorMessage: null, parentJobId: 1},
    ])
  })

  test('should retry a failed job up to the specified number of retries', async () => {
    const executedJobs: Array<{
      data: {payload: unknown; jobId: number}
      attempt: number
    }> = []
    let callCount = 0

    const submitJob = registerJobHandler('failing-job', nowService, async (data, attempt) => {
      executedJobs.push({data, attempt})
      ++callCount
      if (callCount < 3) {
        throw new Error('Job failed')
      }

      return {description: ''}
    })

    await submitJob({data: 'test'}, {retries: 3})

    await triggerJobsExecution(() => new Date())
    await triggerJobsExecution(() => new Date())
    await triggerJobsExecution(() => new Date())

    await waitForJobsToComplete(sql)

    assert.partialDeepStrictEqual(executedJobs, [
      {data: {payload: {data: 'test'}, jobId: 1}, attempt: 0},
      {data: {payload: {data: 'test'}, jobId: 1}, attempt: 1},
      {data: {payload: {data: 'test'}, jobId: 1}, attempt: 2},
    ])
  })

  test('should delete job after exhausting all retries', async () => {
    const executedJobs: Array<{
      data: {payload: unknown; jobId: number}
      attempt: number
    }> = []

    const submitJob = registerJobHandler(
      'always-failing-job',
      nowService,
      async (data, attempt) => {
        executedJobs.push({data, attempt})
        throw new Error('Job always fails')
      },
    )

    await submitJob({data: 'test'}, {retries: 2})

    await triggerJobsExecution(() => new Date())
    await triggerJobsExecution(() => new Date())

    const completedJobs = await waitForJobsToComplete(sql)

    assert.partialDeepStrictEqual(executedJobs, [
      {data: {payload: {data: 'test'}, jobId: 1}, attempt: 0},
      {data: {payload: {data: 'test'}, jobId: 1}, attempt: 1},
      {data: {payload: {data: 'test'}, jobId: 1}, attempt: 2},
    ])

    assert.partialDeepStrictEqual(completedJobs, [
      {
        id: 1,
        errorMessage: 'Job always fails',
        parentJobId: null,
      },
    ])

    assert.ok(completedJobs[0].error?.includes('Error: Job always fails'))
  })

  test('should only execute jobs scheduled in the past or now', async () => {
    const now = Date.now()
    const executedJobs: string[] = []

    const submitJob = registerJobHandler(
      'scheduled-job',
      nowService,
      async ({payload}: {payload: {id: string}}) => {
        executedJobs.push(payload.id)
        return {description: ''}
      },
    )

    // Job scheduled in the past
    await submitJob({id: 'past'}, {scheduledAt: new Date(now - 5000), retries: 3})

    // Job scheduled now
    await submitJob({id: 'now'}, {scheduledAt: new Date(now), retries: 3})

    // Job scheduled in the future
    const future = now + 700_000
    await submitJob({id: 'future'}, {scheduledAt: new Date(future), retries: 3})

    triggerJobsExecution(() => new Date(now))

    await waitForJobsToComplete(sql, 1)

    // Only past and now jobs should be executed
    assert.strictEqual(executedJobs.length, 2)
    assert.ok(executedJobs.includes('past'))
    assert.ok(executedJobs.includes('now'))
    assert.ok(!executedJobs.includes('future'))

    const pastTheFuture = future + 1

    triggerJobsExecution(() => new Date(pastTheFuture))

    await waitForJobsToComplete(sql)

    assert.strictEqual(executedJobs.length, 3)
    assert.ok(executedJobs.includes('past'))
    assert.ok(executedJobs.includes('now'))
    assert.ok(executedJobs.includes('future'))
  })

  test('should handle multiple jobs in sequence', async () => {
    const executedJobs: string[] = []

    const submitJob = registerJobHandler(
      'multi-job',
      nowService,
      async ({payload}: {payload: {id: string}}) => {
        executedJobs.push(payload.id)
        return {description: ''}
      },
    )

    await submitJob({id: 'zjob1'}, {retries: 3})
    await submitJob({id: 'zjob2'}, {retries: 3})
    await submitJob({id: 'zjob3'}, {retries: 3})

    await waitForJobsToComplete(sql)

    assert.deepStrictEqual(executedJobs, ['zjob1', 'zjob2', 'zjob3'])

    const jobs = await sql`SELECT * FROM job WHERE finished_at IS NULL`
    assert.strictEqual(jobs.length, 0)
  })

  test('should handle job handler that throws an error', async () => {
    const submitJob = registerJobHandler('error-job', nowService, async () => {
      throw new Error('Handler error')
    })

    await submitJob({data: 'test'}, {retries: 1})

    await triggerJobsExecution(() => new Date())

    await waitForJobsToComplete(sql)
  })

  test('should not execute jobs without registered handler', async () => {
    // Insert a job directly without registering a handler
    await sql`
      INSERT INTO job (type, payload, number_of_retries, scheduled_at, attempts)
      VALUES ('unregistered-job', '{"data": "test"}', 2, NOW(), 0)
    `
    await triggerJobsExecution(() => new Date())

    await waitForJobsToComplete(sql)

    // Check that error was logged
    const testLogger = logger as unknown as {
      logs: Array<{level: string; message: string; data?: unknown}>
    }
    assert.ok(testLogger.logs.some((log) => log.level === 'error'))
  })

  test('should handle concurrent job execution with mutex', async () => {
    const executedJobs: string[] = []

    const submitJob = registerJobHandler(
      'mutex-job',
      nowService,
      async ({payload}: {payload: {id: string}}) => {
        executedJobs.push(payload.id)
        // Simulate long-running job
        await setTimeout(50)
        return {description: ''}
      },
    )

    await submitJob({id: 'job1'}, {retries: 3})

    // Trigger multiple times quickly - mutex should prevent concurrent execution
    triggerJobsExecution(() => new Date())
    triggerJobsExecution(() => new Date())
    triggerJobsExecution(() => new Date())

    await waitForJobsToComplete(sql)

    // Job should only be executed once despite multiple triggers
    assert.strictEqual(executedJobs.length, 1)
  })

  test('should garbage collect old jobs', async () => {
    const submitJob = registerJobHandler('simple-job', nowService, async () => ({description: ''}))

    await submitJob({data: 'test'}, {retries: 1})

    assert.strictEqual((await waitForJobsToComplete(sql)).length, 1)

    await triggerJobsExecution(() => new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)) // Trigger after 6 days

    assert.strictEqual((await waitForJobsToComplete(sql)).length, 1)

    await triggerJobsExecution(() => new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)) // Trigger after 7 days

    assert.strictEqual((await waitForJobsToComplete(sql)).length, 0)
  })
})

async function waitForJobsToComplete(sql: Sql, numberOfJobsLeftInQueue: number = 0) {
  await retry(
    async () =>
      assert.strictEqual(
        (await sql`SELECT * FROM job WHERE finished_at IS NULL`).length,
        numberOfJobsLeftInQueue,
      ),
    {
      retries: 10,
      minTimeout: 100,
      maxTimeout: 200,
    },
  )

  return [
    ...((await sql`
    SELECT
      id, error_message, error, parent_job_id, description
    FROM
      job
    WHERE
      finished_at IS NOT NULL
  `) as Array<{
      id: number
      errorMessage: string | null
      error: string | null
      parentJobId: number | null
      description: string | null
    }>),
  ]
}
