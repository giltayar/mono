import {after, before, beforeEach, describe, test} from 'node:test'
import assert from 'node:assert/strict'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import postgres, {type Sql} from 'postgres'
import type {FastifyBaseLogger} from 'fastify'
import {migrate} from '@giltayar/carmbo-common/sql/migration'
import {
  executeDirectJob,
  initializeJobExecutor,
  triggerJobsExecution,
} from '@giltayar/carmbo-pages-job/jobs/executor'
import {registerJobHandler} from '@giltayar/carmbo-pages-job/jobs/handler'
import {TEST_resetJobHandlers} from '../../testkit/carmbo-pages-job-testkit.ts'

const baseNow = new Date('2026-01-01T00:00:00.000Z')
const executionNow = new Date('2026-01-01T00:01:00.000Z')
const nowService = () => baseNow

function createTestLogger(): FastifyBaseLogger {
  const logger = {
    info() {},
    error() {},
    child() {
      return logger
    },
  }

  return logger as unknown as FastifyBaseLogger
}

describe('job execution', () => {
  let sql: Sql
  let teardown: (() => Promise<void>) | undefined
  const logger = createTestLogger()

  before(async () => {
    const dockerCompose = await runDockerCompose(
      new URL('./docker-compose.yaml', import.meta.url),
      {variation: import.meta.url},
    )
    teardown = dockerCompose.teardown

    const address = await dockerCompose.findAddress('job-test-postgres', 5432, {
      healthCheck: async (candidate) => {
        const [host, port] = candidate.split(':')
        const healthSql = postgres({
          host,
          port: parseInt(port, 10),
          database: 'job_test',
          user: 'test_user',
          password: 'test_password',
        })
        await healthSql`SELECT 1`
        await healthSql.end()
      },
    })
    const [host, port] = address.split(':')

    sql = postgres({
      host,
      port: parseInt(port, 10),
      database: 'job_test',
      user: 'test_user',
      password: 'test_password',
      transform: {...postgres.camel},
    })

    await migrate({sql})
    initializeJobExecutor(sql, logger)
  })

  after(async () => {
    await sql.end()
    await teardown?.()
  })

  beforeEach(async () => {
    await sql`TRUNCATE TABLE job RESTART IDENTITY CASCADE`
    TEST_resetJobHandlers()
  })

  test('registers and executes queued jobs', async () => {
    const executions: Array<{payload: unknown; attempt: number}> = []
    const submitJob = registerJobHandler(
      'test-job',
      nowService,
      {isTrivial: false},
      (payload: {message: string}) => `job ${payload.message}`,
      async ({payload}, attempt) => {
        executions.push({payload, attempt})
      },
    )

    await submitJob({message: 'Hello'}, {scheduledAt: executionNow, retries: 3})
    await triggerJobsExecution(() => executionNow)

    const jobs = await sql`SELECT * FROM job ORDER BY id`
    assert.deepEqual(executions, [{payload: {message: 'Hello'}, attempt: 0}])
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].description, 'job Hello')
    assert.ok(jobs[0].finishedAt)
    assert.equal(jobs[0].error, null)
  })

  test('retries failures and records the final error', async () => {
    const attempts: number[] = []
    const submitJob = registerJobHandler(
      'failing-job',
      nowService,
      {isTrivial: false},
      () => 'failing job',
      async (_data, attempt) => {
        attempts.push(attempt)
        throw new Error(`failure ${attempt}`)
      },
    )

    await submitJob({}, {scheduledAt: executionNow, retries: 1})
    await triggerJobsExecution(() => executionNow)
    await triggerJobsExecution(() => executionNow)

    const [job] = await sql`SELECT * FROM job`
    assert.deepEqual(attempts, [0, 1])
    assert.equal(job.attempts, 2)
    assert.equal(job.errorMessage, 'failure 1')
    assert.ok(job.finishedAt)
  })

  test('records direct job success and failure', async () => {
    await executeDirectJob(async () => ({description: 'direct success'}), nowService, sql, logger, {
      isTrivial: true,
      description: 'running direct job',
    })

    await assert.rejects(
      executeDirectJob(
        async () => {
          throw new Error('direct failure')
        },
        nowService,
        sql,
        logger,
        {isTrivial: false, description: 'failing direct job'},
      ),
      {message: 'direct failure'},
    )

    const jobs = await sql`SELECT * FROM job ORDER BY id`
    assert.equal(jobs[0].description, 'direct success')
    assert.equal(jobs[0].isTrivial, true)
    assert.equal(jobs[0].error, null)
    assert.equal(jobs[1].description, 'failing direct job')
    assert.equal(jobs[1].errorMessage, 'direct failure')
    assert.equal(jobs[1].attempts, 1)
  })

  test('garbage collects jobs older than 30 days', async () => {
    await executeDirectJob(async () => undefined, nowService, sql, logger, {
      isTrivial: false,
      description: 'old direct job',
    })

    await triggerJobsExecution(() => new Date('2026-02-01T00:00:01.000Z'))

    const jobs = await sql`SELECT * FROM job`
    assert.equal(jobs.length, 0)
  })
})
