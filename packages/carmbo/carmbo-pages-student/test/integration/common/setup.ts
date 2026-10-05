import {fastifyRequestContext} from '@fastify/request-context'
import formbody from '@fastify/formbody'
import {initializei18next} from '@giltayar/carmbo-commons/commons/i18next-utils'
import type {TEST_HookFunction} from '@giltayar/carmbo-commons/commons/TEST_hooks'
import {setUiConfiguration} from '@giltayar/carmbo-commons/commons/ui-configuration'
import {setVersion} from '@giltayar/carmbo-commons/commons/version'
import {layoutAssetRoutes} from '@giltayar/carmbo-commons/layout/assets'
import {migrate} from '@giltayar/carmbo-commons/sql/migration'
import {createFakeAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/testkit'
import {createFakeRavmesserIntegrationService} from '@giltayar/carmel-tools-ravmesser-integration/testkit'
import {createFakeSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/testkit'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import {test} from '@playwright/test'
import fastify, {type FastifyInstance} from 'fastify'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import type {AddressInfo} from 'node:net'
import {readFile} from 'node:fs/promises'
import postgres, {type Sql} from 'postgres'
import qs from 'qs'
import {routes} from '../../../src/route.ts'

export function setup(
  testUrl: string,
  {language = 'en'}: {language?: 'en' | 'he'} = {},
): {
  url: () => URL
  sql: () => Sql
  smooveIntegration: () => ReturnType<typeof createFakeSmooveIntegrationService>
  ravmesserIntegration: () => ReturnType<typeof createFakeRavmesserIntegrationService>
  academyIntegration: () => ReturnType<typeof createFakeAcademyIntegrationService>
  TEST_hooks: Record<string, TEST_HookFunction>
} {
  const TEST_hooks: Record<string, TEST_HookFunction> = {}
  let app: FastifyInstance
  let database: Sql
  let baseUrl: URL
  let teardown: (() => Promise<void>) | undefined
  let smooveIntegration: ReturnType<typeof createFakeSmooveIntegrationService>
  let ravmesserIntegration: ReturnType<typeof createFakeRavmesserIntegrationService>
  let academyIntegration: ReturnType<typeof createFakeAcademyIntegrationService>

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

    smooveIntegration = createFakeSmooveIntegrationService({
      lists: [{id: 2, name: 'Smoove List ID 1'}],
      contacts: {},
    })
    ravmesserIntegration = createFakeRavmesserIntegrationService({
      lists: [
        {id: 100, name: 'Ravmesser All Lists', isAllLists: true},
        {id: 102, name: 'Ravmesser List ID 1'},
      ],
      contacts: {},
    })
    academyIntegration = createFakeAcademyIntegrationService({
      accounts: new Map([
        [
          'carmel',
          {
            courses: [
              {id: 1, name: 'Course 1'},
              {id: 33, name: 'Course 2'},
            ],
            enrolledContacts: new Map([
              [
                'john.already-enrolled@example.com',
                {name: 'John Already-Enrolled', phone: '123-456-7890', enrolledInCourses: [1, 33]},
              ],
              [
                'jane.already-enrolled@example.com',
                {name: 'Jane Already-Enrolled', phone: '234-567-8901', enrolledInCourses: [1]},
              ],
              [
                'bob.already-enrolled@example.com',
                {name: 'Bob Already-Enrolled', phone: '345-678-9012', enrolledInCourses: [33]},
              ],
            ]),
          },
        ],
        [
          'inspiredlivingdaily',
          {
            courses: [{id: 100, name: 'ILD Course 1'}],
            enrolledContacts: new Map(),
          },
        ],
      ]),
    })

    await initializei18next(language)
    setVersion('1.0.0')
    setUiConfiguration(language === 'he' ? 'liraz' : 'carmel')

    app = fastify()
    app.register(formbody, {parser: (body) => qs.parse(body)})
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    app.register(fastifyRequestContext, {
      defaultStoreValues: () => ({TEST_hooks}),
    })
    app.register(layoutAssetRoutes)
    app.get<{Params: {asset: string}}>('/dist/1.0.0/:asset', async (request, reply) => {
      const assets = {
        'bootstrap.min.css': {
          url: new URL(
            '../../../node_modules/bootstrap/dist/css/bootstrap.min.css',
            import.meta.url,
          ),
          contentType: 'text/css; charset=utf-8',
        },
        'bootstrap.rtl.min.css': {
          url: new URL(
            '../../../node_modules/bootstrap/dist/css/bootstrap.rtl.min.css',
            import.meta.url,
          ),
          contentType: 'text/css; charset=utf-8',
        },
        'bootstrap.bundle.min.js': {
          url: new URL(
            '../../../node_modules/bootstrap/dist/js/bootstrap.bundle.min.js',
            import.meta.url,
          ),
          contentType: 'application/javascript; charset=utf-8',
        },
        'htmx.min.js': {
          url: new URL('../../../node_modules/htmx.org/dist/htmx.min.js', import.meta.url),
          contentType: 'application/javascript; charset=utf-8',
        },
      } as const
      const asset = assets[request.params.asset as keyof typeof assets]

      if (!asset) {
        return reply.status(404).send()
      }

      return reply.type(asset.contentType).send(await readFile(asset.url))
    })
    app.register(routes, {
      prefix: '/students',
      sql: database,
      academyIntegration,
      academyAccountSubdomains: ['carmel', 'inspiredlivingdaily'],
      smooveIntegration,
      ravmesserIntegration,
      nowService: () => new Date(),
    })

    await app.listen({host: '127.0.0.1', port: 0})
    const {address: serverAddress, port: serverPort} = app.server.address() as AddressInfo
    baseUrl = new URL(`http://${serverAddress}:${serverPort}`)
  })

  test.beforeEach(async () => {
    for (const hookName of Object.keys(TEST_hooks)) {
      delete TEST_hooks[hookName]
    }
    smooveIntegration._test_reset_data()
    ravmesserIntegration._test_reset_data()
    await database`
      TRUNCATE TABLE
        sale,
        sale_history,
        sale_data,
        sale_data_product,
        product,
        product_history,
        product_data,
        sales_event,
        sales_event_history,
        sales_event_data
      RESTART IDENTITY CASCADE
    `
    await database`TRUNCATE TABLE student RESTART IDENTITY CASCADE`
    await database`TRUNCATE TABLE student_history RESTART IDENTITY CASCADE`
  })

  test.afterAll(async () => {
    await app.close()
    await database.end()
    await teardown?.()
  })

  return {
    url: () => baseUrl,
    sql: () => database,
    smooveIntegration: () => smooveIntegration,
    ravmesserIntegration: () => ravmesserIntegration,
    academyIntegration: () => academyIntegration,
    TEST_hooks,
  }
}
