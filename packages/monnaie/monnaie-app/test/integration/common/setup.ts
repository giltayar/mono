import crypto from 'node:crypto'
import {test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import postgres, {type Sql} from 'postgres'
import type {FastifyInstance} from 'fastify'
import type {AddressInfo} from 'node:net'
import {makeApp} from '../../../src/app/monnaie-app.ts'
import {prepareDatabase} from '../../../src/app/prepare-database.ts'

export function setup(testUrl: string): {url: () => URL; sql: () => Sql} {
  const databaseName = 'd' + crypto.createHash('sha256').update(testUrl).digest('hex').slice(0, 62)

  let app: FastifyInstance
  let sql: Sql
  let globalSql: Sql
  let teardown: (() => Promise<void>) | undefined
  let url: URL

  test.beforeAll(async () => {
    const dockerCompose = await runDockerCompose(new URL('../docker-compose.yaml', import.meta.url))
    teardown = dockerCompose.teardown

    const address = await dockerCompose.findAddress('monnaie-postgres', 5432, {
      healthCheck: postgresHealthCheck,
    })

    globalSql = postgres(connectionString(address, 'postgres'))
    await globalSql`CREATE DATABASE ${globalSql(databaseName)}`.catch((error) => {
      if (error.code === '42P04') {
        // the database already exists, from a previous run
        return
      }
      throw error
    })
    ;({app, sql} = makeApp({connectionString: connectionString(address, databaseName)}))

    await prepareDatabase(sql)

    await app.listen({port: 0, host: '127.0.0.1'})

    const {port} = app.server.address() as AddressInfo
    url = new URL(`http://127.0.0.1:${port}`)
  })

  test.beforeEach(async () => {
    await sql`TRUNCATE TABLE calculation RESTART IDENTITY CASCADE`
  })

  test.afterAll(async () => {
    await app?.close()
    await sql?.end()
    await globalSql?.end()
    await teardown?.()
  })

  return {url: () => url, sql: () => sql}
}

function connectionString(address: string, database: string) {
  return `postgres://user:password@${address}/${database}`
}

async function postgresHealthCheck(address: string) {
  const sql = postgres(connectionString(address, 'monnaie'))

  try {
    await sql`SELECT 1`
  } finally {
    await sql.end()
  }
}
