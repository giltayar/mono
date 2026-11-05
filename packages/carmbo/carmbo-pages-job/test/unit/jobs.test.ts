import {after, before, beforeEach, describe, test} from 'node:test'
import assert from 'node:assert/strict'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import postgres, {type Sql} from 'postgres'
import type {FastifyBaseLogger} from 'fastify'
import {migrate} from '@giltayar/carmbo-commons/sql/migration'
import {
  executeDirectJob,
  initializeJobExecutor,
  triggerJobsExecution,
} from '@giltayar/carmbo-pages-job/jobs/executor'
import {
  registerJobHandler,
  type JobHandler,
  type JobSubmitter,
} from '@giltayar/carmbo-pages-job/jobs/handler'
import {TEST_resetJobHandlers} from '@giltayar/carmbo-pages-job/testkit'

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

  test(
    'automatically executes ordinary submissions with the existing defaults',
    {timeout: 5000},
    async () => {
      const execution = Promise.withResolvers<{jobId: number; isLastAttempt: boolean}>()
      const submitJob = registerJobHandler(
        'automatic-job',
        nowService,
        {isTrivial: false},
        () => 'automatic job',
        async ({jobId, isLastAttempt}) => {
          execution.resolve({jobId, isLastAttempt})
        },
      )

      const jobId = await submitJob({}, {})
      assert.deepEqual(await execution.promise, {jobId, isLastAttempt: false})
      await triggerJobsExecution(nowService)

      const [job] = await sql`SELECT * FROM job`
      assert.equal(job.numberOfRetries, 3)
      assert.equal(job.attempts, 0)
      assert.ok(job.finishedAt)
    },
  )

  test('enqueues within a transaction and executes only after commit and an explicit trigger', async (t) => {
    const executions: number[] = []
    const info = t.mock.method(logger, 'info')
    const submitJob: JobSubmitter<{message: string}> = registerJobHandler(
      'transactional-job',
      nowService,
      {isTrivial: false},
      ({message}) => message,
      async ({jobId}) => {
        executions.push(jobId)
      },
    )

    const jobId = await sql.begin(async (transaction) => {
      const jobId = await submitJob({message: 'committed job'}, {transaction, retries: 1})
      const [job] = await transaction`SELECT * FROM job WHERE id = ${jobId}`
      assert.equal(job.description, 'committed job')
      assert.deepEqual(job.payload, {message: 'committed job'})
      assert.equal(job.numberOfRetries, 1)
      assert.equal(job.finishedAt, null)
      assert.equal((await sql`SELECT * FROM job`).length, 0)

      await triggerJobsExecution(nowService)
      assert.deepEqual(executions, [])
      assert.equal(
        info.mock.calls.filter((call) => call.arguments[1] === 'execute-jobs-started').length,
        1,
      )
      return jobId
    })

    const [queued] = await sql`SELECT * FROM job WHERE id = ${jobId}`
    assert.equal(queued.finishedAt, null)
    assert.deepEqual(executions, [])

    await triggerJobsExecution(nowService)
    assert.deepEqual(executions, [jobId])
    const [finished] = await sql`SELECT * FROM job WHERE id = ${jobId}`
    assert.ok(finished.finishedAt)
  })

  test('rolls back transactional submissions without executing them', async () => {
    const executions: number[] = []
    const submitJob = registerJobHandler(
      'rolled-back-job',
      nowService,
      {isTrivial: false},
      () => 'rolled back job',
      async ({jobId}) => {
        executions.push(jobId)
      },
    )

    await assert.rejects(
      sql.begin(async (transaction) => {
        await submitJob({}, {transaction})
        throw new Error('rollback membership creation')
      }),
      {message: 'rollback membership creation'},
    )

    await triggerJobsExecution(nowService)
    assert.equal((await sql`SELECT * FROM job`).length, 0)
    assert.deepEqual(executions, [])
  })

  for (const retries of [0, 1, 3]) {
    test(`reports the last attempt and records the final error with ${retries} retries`, async () => {
      const attempts: Array<{attempt: number; isLastAttempt: boolean}> = []
      const handler: JobHandler = async ({isLastAttempt}, attempt) => {
        attempts.push({attempt, isLastAttempt})
        throw new Error(`failure ${attempt}`)
      }
      const submitJob = registerJobHandler(
        'failing-job',
        nowService,
        {isTrivial: false},
        () => 'failing job',
        handler,
      )

      await submitJob({}, {scheduledAt: executionNow, retries})
      for (let attempt = 0; attempt <= retries; attempt++) {
        await triggerJobsExecution(() => executionNow)
        const [job] = await sql`SELECT * FROM job`
        assert.equal(job.attempts, attempt + 1)
        assert.equal(job.errorMessage, `failure ${attempt}`)
        assert.equal(job.finishedAt !== null, attempt === retries)
      }
      await triggerJobsExecution(() => executionNow)
      assert.deepEqual(
        attempts,
        Array.from({length: retries + 1}, (_, attempt) => ({
          attempt,
          isLastAttempt: attempt === retries,
        })),
      )
    })
  }

  test('allows a job to succeed on its last attempt', async () => {
    const attempts: Array<{attempt: number; isLastAttempt: boolean}> = []
    const submitJob = registerJobHandler(
      'eventually-successful-job',
      nowService,
      {isTrivial: false},
      () => 'pending job',
      async ({isLastAttempt}, attempt) => {
        attempts.push({attempt, isLastAttempt})
        if (!isLastAttempt) throw new Error('retry')
        return {description: 'success on last attempt'}
      },
    )

    await submitJob({}, {scheduledAt: executionNow, retries: 1})
    await triggerJobsExecution(() => executionNow)
    await triggerJobsExecution(() => executionNow)
    await triggerJobsExecution(() => executionNow)

    assert.deepEqual(attempts, [
      {attempt: 0, isLastAttempt: false},
      {attempt: 1, isLastAttempt: true},
    ])
    const [job] = await sql`SELECT * FROM job`
    assert.ok(job.finishedAt)
    assert.equal(job.attempts, 1)
    assert.equal(job.description, 'success on last attempt')
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
