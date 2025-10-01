import {test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import type {Sql} from 'postgres'
import {makeApp} from '../../../src/app/carmbo-app.ts'
import type {FastifyInstance} from 'fastify'
import type {AddressInfo} from 'node:net'
import postgres from 'postgres'

export function setup(testUrl: string) {
  let findAddress
  let teardown: (() => Promise<void>) | undefined
  let app: FastifyInstance
  let sql: Sql
  let url: URL

  test.beforeAll(async () => {
    ;({findAddress, teardown} = await runDockerCompose(
      new URL('../docker-compose.yaml', import.meta.url),
      {variation: testUrl},
    ))

    const host = await findAddress('carmbo-postgres', 5432, {healthCheck: postgresHealthCheck})

    ;({app, sql} = makeApp({
      db: {
        host: host.split(':')[0],
        port: parseInt(host.split(':')[1]),
        username: 'user',
        password: 'password',
      },
    }))

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
