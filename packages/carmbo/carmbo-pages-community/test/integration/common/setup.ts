import {fastifyRequestContext} from '@fastify/request-context'
import formbody from '@fastify/formbody'
import {initializei18next} from '@giltayar/carmbo-commons/commons/i18next-utils'
import type {TEST_HookFunction} from '@giltayar/carmbo-commons/commons/TEST_hooks'
import {setUiConfiguration} from '@giltayar/carmbo-commons/commons/ui-configuration'
import {setVersion} from '@giltayar/carmbo-commons/commons/version'
import {layoutAssetRoutes} from '@giltayar/carmbo-commons/layout/assets'
import {migrate} from '@giltayar/carmbo-commons/sql/migration'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import {test} from '@playwright/test'
import fastify, {type FastifyInstance} from 'fastify'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import type {AddressInfo} from 'node:net'
import {readFile} from 'node:fs/promises'
import postgres, {type Sql} from 'postgres'
import {routes} from '../../../src/route.ts'
import {routes as studentRoutes} from '@giltayar/carmbo-pages-student/routes'
import qs from 'qs'

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
  TEST_hooks: Record<string, TEST_HookFunction>
} {
  const TEST_hooks: Record<string, TEST_HookFunction> = {}
  let app: FastifyInstance
  let database: Sql
  let baseUrl: URL
  let teardown: (() => Promise<void>) | undefined

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
    app.register(formbody, {parser: (body) => qs.parse(body)})
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    app.register(fastifyRequestContext, {
      defaultStoreValues: () => ({TEST_hooks}),
    })
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
    app.register(routes, {
      prefix: '/communities',
      sql: database,
      nowService,
    })
    app.register(studentRoutes, {
      prefix: '/students',
      sql: database,
      nowService,
      academyIntegration: undefined,
      academyAccountSubdomains: undefined,
      smooveIntegration: undefined,
      ravmesserIntegration: undefined,
    })

    await app.listen({host: '127.0.0.1', port: 0})
    const {address: serverAddress, port: serverPort} = app.server.address() as AddressInfo
    baseUrl = new URL(`http://${serverAddress}:${serverPort}`)
  })

  test.beforeEach(async () => {
    for (const hookName of Object.keys(TEST_hooks)) {
      delete TEST_hooks[hookName]
    }
    await database`
      TRUNCATE TABLE
        community,
        community_history,
        community_data,
        community_search,
        community_member,
        community_member_data,
        community_member_history,
        student,
        student_history,
        student_data,
        student_search,
        student_name,
        student_email,
        student_phone,
        student_facebook_name,
        student_integration_smoove,
        student_integration_ravmesser
      RESTART IDENTITY CASCADE
    `
  })

  test.afterAll(async () => {
    await app?.close()
    await database?.end()
    await teardown?.()
  })

  return {
    url: () => baseUrl,
    sql: () => database,
    TEST_hooks,
  }
}
