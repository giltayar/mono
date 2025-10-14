import {test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import type {Sql} from 'postgres'
import postgres from 'postgres'
import {
  createSmooveIntegrationService,
  type SmooveIntegrationService,
} from '@giltayar/carmel-tools-smoove-integration/service'
import {migrate} from '../../../src/sql/migration.ts'
import {fileURLToPath} from 'node:url'

export function setup(testUrl: string): {
  url: () => URL
  sql: () => Sql
  smooveIntegration: SmooveIntegrationService
} {
  let findAddress
  let teardown: (() => Promise<void>) | undefined
  let sql: Sql
  let url: URL

  test.beforeAll(async () => {
    ;({findAddress, teardown} = await runDockerCompose(
      new URL('../docker-compose.yaml', import.meta.url),
      {
        variation: testUrl,
        forceRecreate: true,
        containerCleanup: true,
        env: {
          FORCE_NO_AUTH: '1',
        },
      },
    ))

    const appPort = await findAddress('app', 3000)
    const sqlPort = await findAddress('postgres', 5432, {healthCheck: postgresHealthCheck})

    url = new URL(`http://localhost:${appPort.split(':')[1]}`)

    sql = postgres({
      host: 'localhost',
      port: parseInt(sqlPort.split(':')[1]),
      database: 'carmbo',
      username: 'user',
      password: 'password',
      transform: {...postgres.camel},
    })

    await migrate({sql, path: fileURLToPath(new URL('../../../src/sql', import.meta.url))})
  })

  test.beforeEach(async () => {
    await sql`TRUNCATE TABLE student RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE student_history RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE product RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE product_history RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sales_event RESTART IDENTITY CASCADE`
    await sql`TRUNCATE TABLE sales_event_history RESTART IDENTITY CASCADE`
  })

  test.afterAll(async () => teardown?.())

  const smooveIntegration: SmooveIntegrationService = createSmooveIntegrationService({
    apiKey: process.env.SMOOVE_TEST_API_KEY!,
    apiUrl: 'https://rest.smoove.io/v1/',
  })

  return {
    url: () => url,
    sql: () => sql,
    smooveIntegration,
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
