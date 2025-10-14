import {test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import type {Sql} from 'postgres'
import {makeApp} from '../../../src/app/carmbo-app.ts'
import type {FastifyInstance} from 'fastify'
import type {AddressInfo} from 'node:net'
import postgres from 'postgres'
import {createFakeAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/testkit'
import {createFakeWhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/testkit'
import {createFakeSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/testkit'
import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
// //@ts-expect-error no types
// import shift from 'postgres-shift'
// import {fileURLToPath} from 'node:url'

export function setup(testUrl: string): {
  url: () => URL
  sql: () => Sql
  smooveIntegration: () => SmooveIntegrationService
  academyIntegration: () => ReturnType<typeof createFakeAcademyIntegrationService>
} {
  let findAddress
  let teardown: (() => Promise<void>) | undefined
  let app: FastifyInstance
  let sql: Sql
  let url: URL
  let smooveIntegration: SmooveIntegrationService
  let academyIntegration: ReturnType<typeof createFakeAcademyIntegrationService>

  test.beforeAll(async () => {
    ;({findAddress, teardown} = await runDockerCompose(
      new URL('../docker-compose.yaml', import.meta.url),
      {variation: testUrl},
    ))

    const host = await findAddress('carmbo-postgres', 5432, {healthCheck: postgresHealthCheck})

    smooveIntegration = createFakeSmooveIntegrationService({
      lists: [
        {id: 2, name: 'Smoove List ID 1'},
        {id: 4, name: 'Smoove List Cancelling 2'},
        {id: 6, name: 'Smoove List Cancelled 3'},
        {id: 8, name: 'Smoove List Removed 4'},
        {id: 10, name: 'Smoove List ID A'},
        {id: 12, name: 'Smoove List Cancelling B'},
        {id: 14, name: 'Smoove List Cancelled C'},
        {id: 16, name: 'Smoove List Removed D'},
      ],
      contacts: {},
    })
    academyIntegration = createFakeAcademyIntegrationService({
      courses: [
        {id: 1, name: 'Course 1'},
        {id: 33, name: 'Course 2'},
        {id: 777, name: 'Course 3'},
      ],
      enrolledContacts: new Map(),
    })
    ;({app, sql} = makeApp({
      db: {
        database: 'carmbo',
        host: host.split(':')[0],
        port: parseInt(host.split(':')[1]),
        username: 'user',
        password: 'password',
      },
      services: {
        academyIntegration,
        whatsappIntegration: createFakeWhatsAppIntegrationService({
          groups: {
            '1@g.us': {
              name: 'Test Group 1',
              recentSentMessages: [],
              participants: [],
            },
            '2@g.us': {
              name: 'Test Group 2',
              recentSentMessages: [],
              participants: [],
            },
            '3@g.us': {
              name: 'Test Group 3',
              recentSentMessages: [],
              participants: [],
            },
          },
        }),
        smooveIntegration,
      },
      auth0: undefined,
      appBaseUrl: 'http://localhost:????',
    }))

    // await shift({sql, path: fileURLToPath(new URL('../../../src/sql', import.meta.url))})

    await app.listen()
    app.server.unref()

    const {port, address} = app.server.address() as AddressInfo

    url = new URL(`http://${address}:${port}`)
  })

  test.beforeEach(async () => {
    await sql`TRUNCATE TABLE student RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE student_history RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE product RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE product_history RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sales_event RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sales_event_history RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_history RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_info RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_info_product RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_info_cardcom RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sale_info_search RESTART IDENTITY CASCADE`
  })

  test.afterAll(async () => teardown?.())

  return {
    url: () => url,
    sql: () => sql,
    smooveIntegration: () => smooveIntegration,
    academyIntegration: () => academyIntegration,
  }
}

async function postgresHealthCheck(address: string) {
  const [host, port] = address.split(':')

  const sql = postgres({
    host,
    port: parseInt(port, 10),
    database: 'carmbo',
    user: 'user',
    password: 'password',
  })

  await sql`SELECT 1`
}
