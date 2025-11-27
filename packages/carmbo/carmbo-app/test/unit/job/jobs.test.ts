import {test, describe, before, after, beforeEach} from 'node:test'
import assert from 'node:assert'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import postgres from 'postgres'
import type {Sql} from 'postgres'
import retry from 'p-retry'
import {
  registerGlobalHelpersForJobExecution,
  triggerJobsExecution,
} from '../../../src/domain/job/job-executor.ts'
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

    registerGlobalHelpersForJobExecution(sql, logger)
  })

  after(() => teardown?.())

  beforeEach(async () => {
    // Clear the jobs table and reset job handlers
    await sql`TRUNCATE TABLE jobs RESTART IDENTITY CASCADE`
    jobHandlers.clear()
  })

  test('should execute a job successfully and delete it from the database', async () => {
    const executedJobs: Array<{payload: unknown; attempt: number}> = []

    const submitJob = registerJobHandler('test-job', async (payload, attempt) => {
      executedJobs.push({payload, attempt})
    })

    await submitJob({message: 'Hello World'}, sql, {retries: 3})

    triggerJobsExecution(() => new Date())

    await waitForJobsToComplete(sql)

    assert.strictEqual(executedJobs.length, 1)
    assert.deepStrictEqual(executedJobs[0].payload, {message: 'Hello World'})
    assert.strictEqual(executedJobs[0].attempt, 0)
  })

  test('should retry a failed job up to the specified number of retries', async () => {
    const executedJobs: Array<{payload: unknown; attempt: number}> = []
    let callCount = 0

    const submitJob = registerJobHandler('failing-job', async (payload, attempt) => {
      executedJobs.push({payload, attempt})
      ++callCount
      if (callCount < 3) {
        throw new Error('Job failed')
      }
    })

    await submitJob({data: 'test'}, sql, {retries: 3})

    await triggerJobsExecution(() => new Date())

    await waitForJobsToComplete(sql, 1)

    await triggerJobsExecution(() => new Date())

    await waitForJobsToComplete(sql, 1)

    await triggerJobsExecution(() => new Date())

    await waitForJobsToComplete(sql)

    assert.partialDeepStrictEqual(executedJobs, [
      {payload: {data: 'test'}, attempt: 0},
      {payload: {data: 'test'}, attempt: 1},
      {payload: {data: 'test'}, attempt: 2},
    ])
  })

  test('should delete job after exhausting all retries', async () => {
    const executedJobs: Array<{payload: unknown; attempt: number}> = []

    const submitJob = registerJobHandler('always-failing-job', async (payload, attempt) => {
      executedJobs.push({payload, attempt})
      throw new Error('Job always fails')
    })

    await submitJob({data: 'test'}, sql, {retries: 2})

    // First execution (attempt 0)
    await triggerJobsExecution(() => new Date())

    await waitForJobsToComplete(sql, 1)

    await triggerJobsExecution(() => new Date())
    await waitForJobsToComplete(sql, 1)
    await triggerJobsExecution(() => new Date())
    await waitForJobsToComplete(sql)

    assert.partialDeepStrictEqual(executedJobs, [
      {payload: {data: 'test'}, attempt: 0},
      {payload: {data: 'test'}, attempt: 1},
      {payload: {data: 'test'}, attempt: 2},
    ])
  })

  test('should only execute jobs scheduled in the past or now', async () => {
    const now = Date.now()
    const executedJobs: string[] = []

    const submitJob = registerJobHandler('scheduled-job', async (payload: {id: string}) => {
      executedJobs.push(payload.id)
    })

    // Job scheduled in the past
    await submitJob({id: 'past'}, sql, {scheduledAt: new Date(now - 5000), retries: 3})

    // Job scheduled now
    await submitJob({id: 'now'}, sql, {scheduledAt: new Date(now), retries: 3})

    // Job scheduled in the future
    const future = now + 700_000
    await submitJob({id: 'future'}, sql, {scheduledAt: new Date(future), retries: 3})

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

    const submitJob = registerJobHandler('multi-job', async (payload: {id: string}) => {
      executedJobs.push(payload.id)
    })

    await submitJob({id: 'job1'}, sql, {retries: 3})
    await submitJob({id: 'job2'}, sql, {retries: 3})
    await submitJob({id: 'job3'}, sql, {retries: 3})
    triggerJobsExecution(() => new Date())

    await waitForJobsToComplete(sql)

    assert.strictEqual(executedJobs.length, 3)
    assert.ok(executedJobs.includes('job1'))
    assert.ok(executedJobs.includes('job2'))
    assert.ok(executedJobs.includes('job3'))

    const jobs = await sql`SELECT * FROM jobs`
    assert.strictEqual(jobs.length, 0)
  })

  test('should use transaction for job handler execution', async () => {
    const submitJob = registerJobHandler(
      'transaction-job',
      async (payload: {value: string}, _attempt, _logger, sql) => {
        // Create a test table and insert data within the transaction
        await sql`CREATE TABLE IF NOT EXISTS test_transaction (value TEXT)`
        await sql`INSERT INTO test_transaction VALUES (${payload.value})`

        // Throw an error to rollback the transaction
        throw new Error('Force rollback')
      },
    )

    await submitJob({value: 'test-value'}, sql, {retries: 1})
    void triggerJobsExecution(() => new Date())
    await waitForJobsToComplete(sql, 1)

    void triggerJobsExecution(() => new Date())

    await waitForJobsToComplete(sql)

    // Check if the transaction was rolled back
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'test_transaction'
    `

    // Table should not exist because transaction was rolled back
    assert.strictEqual(tables.length, 0)
  })

  test('should handle job handler that throws an error', async () => {
    const submitJob = registerJobHandler('error-job', async () => {
      throw new Error('Handler error')
    })

    await submitJob({data: 'test'}, sql, {retries: 1})
    await triggerJobsExecution(() => new Date())
    await triggerJobsExecution(() => new Date())

    await waitForJobsToComplete(sql)
  })

  test('should not execute jobs without registered handler', async () => {
    // Insert a job directly without registering a handler
    await sql`
      INSERT INTO jobs (type, payload, number_of_retries, scheduled_at, attempts)
      VALUES ('unregistered-job', '{"data": "test"}', 2, NOW(), 0)
    `
    await triggerJobsExecution(() => new Date())
    await triggerJobsExecution(() => new Date())
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

    const submitJob = registerJobHandler('mutex-job', async (payload: {id: string}) => {
      executedJobs.push(payload.id)
      // Simulate long-running job
      await setTimeout(50)
    })

    await submitJob({id: 'job1'}, sql, {retries: 3})

    // Trigger multiple times quickly - mutex should prevent concurrent execution
    triggerJobsExecution(() => new Date())
    triggerJobsExecution(() => new Date())
    triggerJobsExecution(() => new Date())

    await waitForJobsToComplete(sql)

    // Job should only be executed once despite multiple triggers
    assert.strictEqual(executedJobs.length, 1)
  })
})

async function waitForJobsToComplete(sql: Sql, numberOfJobsLeftInQueue: number = 0) {
  await retry(
    async () => assert.strictEqual((await sql`SELECT * FROM jobs`).length, numberOfJobsLeftInQueue),
    {
      retries: 10,
      minTimeout: 100,
      maxTimeout: 200,
    },
  )
}
