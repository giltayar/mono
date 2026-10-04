import cookie from '@fastify/cookie'
import formbody from '@fastify/formbody'
import {initializei18next} from '@giltayar/carmbo-common/commons/i18next-utils'
import {setUiConfiguration} from '@giltayar/carmbo-common/commons/ui-configuration'
import {setVersion} from '@giltayar/carmbo-common/commons/version'
import {expect, test} from '@playwright/test'
import fastify, {type FastifyInstance} from 'fastify'
import {generateKeyPairSync} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import type {AddressInfo} from 'node:net'
import {routes, useFirebaseAuth} from '../../src/index.ts'
import {TEST_setFirebaseAuth} from '../../src/model-firebase.ts'
import {createFakeFirebaseApp} from './fake-firebase-app.ts'

interface FakeFirebaseAuth {
  revokedUids: string[]
  createSessionCookie(idToken: string, options: {expiresIn: number}): Promise<string>
  verifySessionCookie(
    sessionCookie: string,
    checkRevoked?: boolean,
  ): Promise<{uid: string; email: string}>
  revokeRefreshTokens(uid: string): Promise<void>
}

let app: FastifyInstance
let fakeFirebaseApp: FastifyInstance
let baseUrl: URL
let firebaseAuth: FakeFirebaseAuth
let fakeFirebaseSignInUrl: URL

test.beforeAll(async () => {
  setVersion('1.0.0')
  setUiConfiguration('carmel')
  await initializei18next('en')

  const htmx = await readFile(
    new URL('../../node_modules/htmx.org/dist/htmx.min.js', import.meta.url),
    'utf8',
  )

  ;({app: fakeFirebaseApp, signInWithPasswordUrl: fakeFirebaseSignInUrl} =
    await createFakeFirebaseApp())

  app = fastify()
  app.register(formbody)
  app.register(cookie)
  app.get('/dist/1.0.0/htmx.min.js', async (_, reply) =>
    reply.type('application/javascript').send(htmx),
  )
  app.register(routes, {
    prefix: '/auth',
    firebase: {
      apiKey: 'firebase-api-key',
      serviceAccountJson: createServiceAccountJson(),
    },
  })
  app.register((protectedApp) => {
    useFirebaseAuth(protectedApp)
    protectedApp.get('/', async (_, reply) =>
      reply.type('text/html').send('<h1>Protected page</h1>'),
    )
  })

  await app.listen({host: '127.0.0.1', port: 0})
  const {address, port} = app.server.address() as AddressInfo
  baseUrl = new URL(`http://${address}:${port}`)
})

test.beforeEach(() => {
  firebaseAuth = createFakeFirebaseAuth()
  TEST_setFirebaseAuth(firebaseAuth, fakeFirebaseSignInUrl)
})

test.afterAll(async () => {
  await Promise.all([app.close(), fakeFirebaseApp.close()])
})

test('renders and validates the login page in a browser', async ({page}) => {
  await page.goto(new URL('/auth/login', baseUrl).href)

  await expect(page).toHaveTitle('Login')
  await expect(page.getByRole('heading', {name: 'Login to your account'})).toBeVisible()
  await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email')
  await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password')
  await expect(page.getByRole('button', {name: 'Login'})).toBeVisible()

  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', {name: 'Login'}).click()

  await expect(page).toHaveURL(new URL('/auth/login', baseUrl).href)
  await expect(page.getByText('Invalid email or password')).toBeVisible()
  expect(await page.context().cookies()).not.toContainEqual(
    expect.objectContaining({name: '__session'}),
  )
})

test('logs in and logs out through the browser', async ({page}) => {
  await page.goto(new URL('/', baseUrl).href)
  await expect(page).toHaveURL(new URL('/auth/login', baseUrl).href)

  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Password').fill('secret')
  await page.getByRole('button', {name: 'Login'}).click()

  await expect(page).toHaveURL(baseUrl.href)
  await expect(page.getByRole('heading', {name: 'Protected page'})).toBeVisible()
  expect(await page.context().cookies()).toContainEqual(
    expect.objectContaining({
      name: '__session',
      value: 'session-firebase-id-token',
      httpOnly: true,
      sameSite: 'Lax',
    }),
  )

  await page.goto(new URL('/auth/logout', baseUrl).href)

  await expect(page).toHaveURL(new URL('/auth/login', baseUrl).href)
  await expect(page.getByRole('heading', {name: 'Login to your account'})).toBeVisible()
  expect(firebaseAuth.revokedUids).toEqual(['user-1'])
  expect(await page.context().cookies()).not.toContainEqual(
    expect.objectContaining({name: '__session'}),
  )

  await page.goto(baseUrl.href)
  await expect(page).toHaveURL(new URL('/auth/login', baseUrl).href)
})

function createFakeFirebaseAuth(): FakeFirebaseAuth {
  const revokedUids: string[] = []

  return {
    revokedUids,
    async createSessionCookie(idToken) {
      return `session-${idToken}`
    },
    async verifySessionCookie() {
      return {uid: 'user-1', email: 'user@example.com'}
    },
    async revokeRefreshTokens(uid) {
      revokedUids.push(uid)
    },
  }
}

function createServiceAccountJson(): string {
  const {privateKey} = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {type: 'spki', format: 'pem'},
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
  })

  return JSON.stringify({
    projectId: 'carmbo-pages-auth-test',
    clientEmail: 'firebase-admin@test.invalid',
    privateKey,
  })
}
