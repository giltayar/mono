import {test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import type {Sql} from 'postgres'
import postgres from 'postgres'

export function setup(testUrl: string) {
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

  return {
    url: () => url,
    sql: () => sql,
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
