import crypto from 'node:crypto'
import {test} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import {sql} from 'kysely'
import type {FastifyInstance} from 'fastify'
import type {AddressInfo} from 'node:net'
import {makeApp} from '../../../src/app/monnaie-app.ts'
import {prepareDatabase} from '../../../src/app/prepare-database.ts'
import {createDb, type Db} from '../../../src/commons/db.ts'

export function setup(testUrl: string): {url: () => URL; db: () => Db} {
  const databaseName = 'd' + crypto.createHash('sha256').update(testUrl).digest('hex').slice(0, 62)

  let app: FastifyInstance
  let db: Db
  let globalDb: Db
  let teardown: (() => Promise<void>) | undefined
  let url: URL

  test.beforeAll(async () => {
    const dockerCompose = await runDockerCompose(new URL('../docker-compose.yaml', import.meta.url))
    teardown = dockerCompose.teardown

    const address = await dockerCompose.findAddress('monnaie-postgres', 5432, {
      healthCheck: postgresHealthCheck,
    })

    globalDb = createDb(connectionString(address, 'postgres'))
    // start from a pristine database, so that the migrations always run from scratch
    await sql`DROP DATABASE IF EXISTS ${sql.id(databaseName)}`.execute(globalDb)
    await sql`CREATE DATABASE ${sql.id(databaseName)}`.execute(globalDb)
    ;({app, db} = makeApp({connectionString: connectionString(address, databaseName)}))

    await prepareDatabase(db)

    await app.listen({port: 0, host: '127.0.0.1'})

    const {port} = app.server.address() as AddressInfo
    url = new URL(`http://127.0.0.1:${port}`)
  })

  test.beforeEach(async () => {
    await sql`TRUNCATE TABLE calculation RESTART IDENTITY CASCADE`.execute(db)
  })

  test.afterAll(async () => {
    await app?.close()
    await db?.destroy()
    await globalDb?.destroy()
    await teardown?.()
  })

  return {url: () => url, db: () => db}
}

function connectionString(address: string, database: string) {
  return `postgres://user:password@${address}/${database}`
}

async function postgresHealthCheck(address: string) {
  const db = createDb(connectionString(address, 'monnaie'))

  try {
    await sql`SELECT 1`.execute(db)
  } finally {
    await db.destroy()
  }
}
