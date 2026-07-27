import crypto from 'node:crypto'
import {test, type Page} from '@playwright/test'
import {runDockerCompose} from '@giltayar/docker-compose-testkit'
import {sql} from 'kysely'
import type {FastifyInstance} from 'fastify'
import type {AddressInfo} from 'node:net'
import {makeApp} from '../../../src/app/monnaie-app.ts'
import {createDb, type Db} from '../../../src/commons/db.ts'
import {SESSION_COOKIE_NAME} from '../../../src/commons/auth.ts'
import {ensureUser} from '../../../src/domain/user/model.ts'
import {
  createFakeFirebaseAuth,
  FAKE_FIREBASE_CONFIG,
  FIRST_USER,
  type FakeFirebaseAuth,
  type FakeUser,
} from '../services/fake-firebase-auth.ts'

export function setup(testUrl: string): {
  url: () => URL
  db: () => Db
  auth: () => FakeFirebaseAuth
  logIn: (page: Page, user?: FakeUser) => Promise<void>
} {
  const databaseName = 'd' + crypto.createHash('sha256').update(testUrl).digest('hex').slice(0, 62)

  let app: FastifyInstance
  let db: Db
  let globalDb: Db
  let auth: FakeFirebaseAuth
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

    auth = createFakeFirebaseAuth()
    ;({app, db} = await makeApp({
      connectionString: connectionString(address, databaseName),
      language: 'en',
      auth,
      firebaseConfig: FAKE_FIREBASE_CONFIG,
    }))

    await app.listen({port: 0, host: '127.0.0.1'})

    const {port} = app.server.address() as AddressInfo
    url = new URL(`http://127.0.0.1:${port}`)
  })

  test.beforeEach(async () => {
    await sql`TRUNCATE TABLE app_user, calculation RESTART IDENTITY CASCADE`.execute(db)
    auth.reset()
  })

  test.afterAll(async () => {
    await app?.close()
    await db?.destroy()
    await globalDb?.destroy()
    await teardown?.()
  })

  return {
    url: () => url,
    db: () => db,
    auth: () => auth,
    // Signing in through the login page is what `login/login.test.ts` is for. Every other test only
    // needs to *be* signed in, so it gets a session cookie handed to it: that keeps those tests off
    // the login form, and works whatever language the test happens to run in.
    logIn: async (page, user = FIRST_USER) => {
      const signIn = await auth.signInWithPassword(user.email, user.password)

      if ('error' in signIn) {
        throw new Error(`could not sign ${user.email} in: ${signIn.error}`)
      }

      const session = await auth.createSession(signIn.idToken)

      if ('error' in session) {
        throw new Error(`could not create a session for ${user.email}: ${session.error}`)
      }

      // the row a real login would have made — deliberately with no language in it, since this is
      // not a request and there is no language to inherit. A test that wants a saved language sets
      // it through the app, as a user would.
      await ensureUser(db, user.uid, {})

      await page
        .context()
        .addCookies([{name: SESSION_COOKIE_NAME, value: session.cookie, url: url.href}])
    },
  }
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
