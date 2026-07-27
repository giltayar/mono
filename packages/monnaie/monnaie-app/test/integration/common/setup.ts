import crypto from 'node:crypto'
import {test, type Page} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import {sql} from 'kysely'
import type {FastifyInstance} from 'fastify'
import type {AddressInfo} from 'node:net'
import {makeApp} from '../../../src/app/monnaie-app.ts'
import {createDb, type Db} from '../../../src/commons/db.ts'
import {createFakeAuth, fakeIdToken} from './fake-auth.ts'

export function setup(
  testUrl: string,
  {signedInAs}: {signedInAs?: string} = {},
): {
  url: () => URL
  db: () => Db
  signIn: (page: Page, email: string) => Promise<void>
} {
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
    ;({app, db} = await makeApp({
      connectionString: connectionString(address, databaseName),
      language: 'en',
      auth: createFakeAuth(),
      // the tests are served over plain http, which a `Secure` cookie would never reach
      secureCookies: false,
    }))

    await app.listen({port: 0, host: '127.0.0.1'})

    const {port} = app.server.address() as AddressInfo
    url = new URL(`http://127.0.0.1:${port}`)
  })

  test.beforeEach(async () => {
    await sql`TRUNCATE TABLE calculation RESTART IDENTITY CASCADE`.execute(db)
  })

  if (signedInAs !== undefined) {
    test.beforeEach(async ({page}) => {
      await signIn(page, signedInAs)
    })
  }

  test.afterAll(async () => {
    await app?.close()
    await db?.destroy()
    await globalDb?.destroy()
    await teardown?.()
  })

  /**
   * Signs in the way the login page does once firebase has done its part: by trading an ID token
   * for a session cookie. `page.request` shares its cookie jar with the browser context, so the
   * page itself ends up signed in.
   */
  async function signIn(page: Page, email: string): Promise<void> {
    const response = await page.request.post(new URL('/session', url).href, {
      data: {idToken: fakeIdToken(email)},
    })

    if (!response.ok()) {
      throw new Error(`could not sign in as ${email}: ${response.status()}`)
    }
  }

  return {url: () => url, db: () => db, signIn}
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
