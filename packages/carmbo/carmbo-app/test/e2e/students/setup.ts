import {test} from '@playwright/test'
import {runDockerCompose, tcpHealthCheck} from '@giltayar/docker-compose-testkit'
import type {Sql} from 'postgres'
import postgres from 'postgres'
import {makeApp} from '../../../src/app/carmbo-app.ts'
import type {FastifyInstance} from 'fastify'
import type {AddressInfo} from 'node:net'

export function setup(testUrl: string) {
  let findAddress
  let teardown: (() => Promise<void>) | undefined
  let sql: Sql
  let app: FastifyInstance
  let url: URL

  test.beforeAll(async () => {
    ;({findAddress, teardown} = await runDockerCompose(
      new URL('../docker-compose.yaml', import.meta.url),
      {variation: testUrl},
    ))

    sql = postgres({
      host: await findAddress('carmbo-postgres', 5432, {healthCheck: tcpHealthCheck}),
      database: 'carmbo',
      username: 'user',
      password: 'password',
    })

    app = makeApp({
      db: {
        host: sql.options.host[0],
        port: sql.options.port[0],
        username: sql.options.user,
        password: 'password',
      },
    })

    await app.listen()
    app.server.unref()

    const {port, address} = app.server.address() as AddressInfo

    url = new URL(`http://${address}:${port}`)
  })

  test.beforeEach(async () => {
    await sql`TRUNCATE TABLE student CASCADE`
  })

  test.afterAll(async () => teardown?.())

  return {
    url: () => url,
  }
}
