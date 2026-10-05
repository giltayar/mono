import {test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import {initializei18next} from '@giltayar/carmbo-common/commons/i18next-utils'
import {setUiConfiguration} from '@giltayar/carmbo-common/commons/ui-configuration'
import {setVersion} from '@giltayar/carmbo-common/commons/version'
import {migrate} from '@giltayar/carmbo-common/sql/migration'
import fastify, {type FastifyInstance} from 'fastify'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import type {AddressInfo} from 'node:net'
import postgres, {type Sql} from 'postgres'
import {apiRoutes, routes} from '@giltayar/carmbo-pages-job/routes'
import {initializeJobExecutor} from '@giltayar/carmbo-pages-job/jobs/executor'
import {registerJobLocaleResources} from '../../src/locale-resources.ts'
import {TEST_resetJobHandlers} from '../../testkit/carmbo-pages-job-testkit.ts'

export const baseNow = new Date('2026-01-01T00:00:00.000Z')
export const executionNow = new Date('2026-01-01T00:01:00.000Z')

export function setupJobRoutes(testUrl: string): {url: () => URL; sql: () => Sql} {
  let app: FastifyInstance
  let database: Sql
  let baseUrl: URL
  let teardown: (() => Promise<void>) | undefined

  test.beforeAll(async () => {
    const dockerCompose = await runDockerCompose(
      new URL('./docker-compose.yaml', import.meta.url),
      {variation: testUrl},
    )
    teardown = dockerCompose.teardown

    const address = await dockerCompose.findAddress('job-routes-test-postgres', 5432, {
      healthCheck: async (candidate) => {
        const [host, port] = candidate.split(':')
        const healthSql = postgres({
          host,
          port: parseInt(port, 10),
          database: 'job_routes_test',
          user: 'test_user',
          password: 'test_password',
        })
        await healthSql`SELECT 1`
        await healthSql.end()
      },
    })
    const [host, port] = address.split(':')

    database = postgres({
      host,
      port: parseInt(port, 10),
      database: 'job_routes_test',
      user: 'test_user',
      password: 'test_password',
      transform: {...postgres.camel},
    })

    await migrate({sql: database})
    await initializei18next('en')
    setVersion('1.0.0')
    setUiConfiguration('carmel')

    app = fastify()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    initializeJobExecutor(database, app.log)
    app.register(routes, {prefix: '/jobs', sql: database})
    app.register(apiRoutes, {
      prefix: '/api/jobs',
      secret: 'api-secret',
      nowService: () => executionNow,
    })

    await app.listen({host: '127.0.0.1', port: 0})
    const {address: serverAddress, port: serverPort} = app.server.address() as AddressInfo
    baseUrl = new URL(`http://${serverAddress}:${serverPort}`)
  })

  test.afterAll(async () => {
    await app.close()
    await database.end()
    await teardown?.()
  })

  test.beforeEach(async () => {
    await database`TRUNCATE TABLE job RESTART IDENTITY CASCADE`
    TEST_resetJobHandlers()
    await initializei18next('en')
    registerJobLocaleResources()
  })

  return {
    url: () => baseUrl,
    sql: () => database,
  }
}
