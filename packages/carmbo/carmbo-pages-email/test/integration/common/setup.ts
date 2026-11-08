import {fastifyRequestContext} from '@fastify/request-context'
import {initializei18next} from '@giltayar/carmbo-commons/commons/i18next-utils'
import {setUiConfiguration} from '@giltayar/carmbo-commons/commons/ui-configuration'
import {setVersion} from '@giltayar/carmbo-commons/commons/version'
import {layoutAssetRoutes} from '@giltayar/carmbo-commons/layout/assets'
import {migrate} from '@giltayar/carmbo-commons/sql/migration'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import {test} from '@playwright/test'
import fastify, {type FastifyInstance} from 'fastify'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import type {AddressInfo} from 'node:net'
import {randomBytes} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import postgres, {type Sql} from 'postgres'
import {routes as jobRoutes} from '@giltayar/carmbo-pages-job/routes'
import {initializeJobExecutor, triggerJobsExecution} from '@giltayar/carmbo-pages-job/jobs/executor'
import {TEST_resetJobHandlers} from '@giltayar/carmbo-pages-job/testkit'
import {routes as emailRoutes} from '../../../src/route.ts'
import {webhookRoutes} from '../../../src/webhook-route.ts'
import {
  registerSendEmailJobHandler,
  type EmailResultHandler,
  type EmailToQueue,
  type QueueEmail,
} from '../../../src/jobs.ts'
import {createFakeEmailService, type FakeEmailService} from '../../../testkit/fake-email-service.ts'

export type RecordedResult = Omit<Parameters<EmailResultHandler>[0], 'tx'>

export function setup(
  testUrl: string,
  {
    language = 'en',
    nowService = () => new Date(),
  }: {
    language?: 'en' | 'he'
    nowService?: () => Date
  } = {},
): {
  url: () => URL
  sql: () => Sql
  emailService: () => FakeEmailService
  queueEmail: () => QueueEmail
  queue: (email?: Partial<EmailToQueue>) => Promise<{emailNumber: number; jobId: number}>
  results: () => RecordedResult[]
  // Runs inside the result transaction before the result is recorded; throwing rolls it back.
  onResult: {hook: ((result: RecordedResult) => Promise<void>) | undefined}
  executeJobs: () => Promise<void>
  webhookSigningSecret: string
} {
  const webhookSigningSecret = `whsec_${randomBytes(32).toString('base64')}`
  let app: FastifyInstance
  let database: Sql
  let baseUrl: URL
  let teardown: (() => Promise<void>) | undefined
  let fake = createFakeEmailService({nowService})
  let queueEmail: QueueEmail | undefined
  let results: RecordedResult[] = []
  const onResult: {hook: ((result: RecordedResult) => Promise<void>) | undefined} = {
    hook: undefined,
  }
  const executeJobs = () => triggerJobsExecution(nowService)

  test.beforeAll(async () => {
    const dockerCompose = await runDockerCompose(
      new URL('../docker-compose.yaml', import.meta.url),
      {variation: testUrl},
    )
    teardown = dockerCompose.teardown

    const address = await dockerCompose.findAddress('carmbo-postgres', 5432, {
      healthCheck: async (candidate) => {
        const [host, port] = candidate.split(':')
        const healthSql = postgres({
          host,
          port: parseInt(port, 10),
          database: 'carmbo',
          user: 'user',
          password: 'password',
        })
        await healthSql`SELECT 1`
        await healthSql.end()
      },
    })
    const [host, port] = address.split(':')

    database = postgres({
      host,
      port: parseInt(port, 10),
      database: 'carmbo',
      user: 'user',
      password: 'password',
      transform: {...postgres.camel},
    })
    await migrate({sql: database})

    await initializei18next(language)
    setVersion('1.0.0')
    setUiConfiguration(language === 'he' ? 'liraz' : 'carmel', {withCommunities: true})

    app = fastify()
    TEST_resetJobHandlers()
    initializeJobExecutor(database, app.log)
    queueEmail = registerSendEmailJobHandler({
      sql: database,
      nowService,
      emailService: {sendEmail: (message, options) => fake.sendEmail(message, options)},
      resultHandlers: {
        'registration-email': async ({tx: _tx, ...result}) => {
          await onResult.hook?.(result)
          results.push(result)
        },
      },
    })
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    app.register(fastifyRequestContext, {defaultStoreValues: () => ({TEST_hooks: undefined})})
    app.register(layoutAssetRoutes)
    app.get<{Params: {asset: string}}>('/dist/1.0.0/:asset', async (request, reply) => {
      const assets: Record<string, {path: string; contentType: string}> = {
        'bootstrap.min.css': {
          path: 'bootstrap/dist/css/bootstrap.min.css',
          contentType: 'text/css; charset=utf-8',
        },
        'bootstrap.rtl.min.css': {
          path: 'bootstrap/dist/css/bootstrap.rtl.min.css',
          contentType: 'text/css; charset=utf-8',
        },
        'bootstrap.bundle.min.js': {
          path: 'bootstrap/dist/js/bootstrap.bundle.min.js',
          contentType: 'application/javascript; charset=utf-8',
        },
        'htmx.min.js': {
          path: 'htmx.org/dist/htmx.min.js',
          contentType: 'application/javascript; charset=utf-8',
        },
      }
      const asset = assets[request.params.asset]

      if (!asset) {
        return reply.status(404).send()
      }

      return reply
        .type(asset.contentType)
        .send(await readFile(new URL(`../../../node_modules/${asset.path}`, import.meta.url)))
    })
    app.register(emailRoutes, {prefix: '/emails', sql: database})
    app.register(webhookRoutes, {
      prefix: '/api/emails/resend',
      sql: database,
      signingSecret: webhookSigningSecret,
    })
    app.register(jobRoutes, {prefix: '/jobs', sql: database})

    await app.listen({host: '127.0.0.1', port: 0})
    const {address: serverAddress, port: serverPort} = app.server.address() as AddressInfo
    baseUrl = new URL(`http://${serverAddress}:${serverPort}`)
  })

  test.beforeEach(async () => {
    onResult.hook = undefined
    if (queueEmail) await executeJobs()
    fake = createFakeEmailService({nowService})
    results = []
    await database`
      TRUNCATE TABLE
        email,
        job,
        community,
        community_history,
        community_data,
        community_member,
        student,
        student_history,
        student_name
      RESTART IDENTITY CASCADE
    `
  })

  test.afterAll(async () => {
    onResult.hook = undefined
    if (queueEmail) await executeJobs()
    await app?.close()
    await database?.end()
    await teardown?.()
  })

  function getQueueEmail(): QueueEmail {
    if (!queueEmail) throw new Error('queueEmail is not initialized')
    return queueEmail
  }

  return {
    url: () => baseUrl,
    sql: () => database,
    webhookSigningSecret,
    emailService: () => fake,
    executeJobs,
    queueEmail: getQueueEmail,
    queue: (email = {}) =>
      database.begin((tx) =>
        getQueueEmail()(
          {
            purpose: 'registration-email',
            from: 'Sender <sender@example.com>',
            to: 'alice@example.com',
            subject: 'Welcome to Community',
            html: '<p>Hello Alice Student, welcome to Community.</p>',
            text: 'Hello Alice Student, welcome to Community.',
            language,
            payload: {communityNumber: 1, studentNumber: 2},
            ...email,
          },
          nowService(),
          tx,
        ),
      ),
    results: () => results,
    onResult,
  }
}
