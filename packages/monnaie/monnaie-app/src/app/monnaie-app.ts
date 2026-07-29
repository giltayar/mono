import fastify, {type FastifyInstance} from 'fastify'
import formbody from '@fastify/formbody'
import fastifyStatic from '@fastify/static'
import cookie from '@fastify/cookie'
import {fastifyRequestContext} from '@fastify/request-context'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import expensesRoutes from '../domain/expenses/route.ts'
import languageRoutes from '../domain/language/route.ts'
import loginRoutes from '../domain/login/route.ts'
import {userSettings} from '../domain/user/model.ts'
import {prepareDatabase} from './prepare-database.ts'
import {createDb, type Db} from '../commons/db.ts'
import {requireAuthentication, resolveUser} from '../commons/auth.ts'
import type {FirebaseAuth, PublicFirebaseConfig} from '../services/firebase-auth.ts'
import {initializeI18n, resolveLanguage, type Language} from '../commons/i18n.ts'
import {version} from '../commons/version.ts'

export async function makeApp({
  connectionString,
  language,
  timeZone,
  auth,
  firebaseConfig,
}: {
  connectionString: string
  /** The language to use when the request asks for no language we support */
  language: Language
  /** The IANA timezone the calendar periods of the summary are calculated in */
  timeZone: string
  auth: FirebaseAuth
  /** The public half of the Firebase configuration, which the login page sends to the browser */
  firebaseConfig: PublicFirebaseConfig
}): Promise<{
  app: FastifyInstance
  db: Db
}> {
  const app = fastify({
    logger:
      process.env.NODE_ENV !== 'test'
        ? {
            level: 'info',
            formatters: {
              level(label, _number) {
                return {level: label}
              },
            },
          }
        : false,
  })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const db = createDb(connectionString)

  // independent of one another, so no reason to wait for one before starting the other
  await Promise.all([initializeI18n(language), prepareDatabase(db)])

  app.register(formbody)
  // must be registered before `fastifyRequestContext`, which reads `request.cookies` in its own
  // `onRequest` hook: same-level fastify hooks run in registration order
  app.register(cookie)
  app.register(fastifyRequestContext, {
    defaultStoreValues: (request) => ({language: resolveLanguage(request), user: undefined}),
  })

  app.register(fastifyStatic, {
    root: new URL('../../dist', import.meta.url),
    prefix: `/dist/${version}/`,
    decorateReply: false,
    immutable: true,
    maxAge: '1y',
  })
  app.register(fastifyStatic, {
    root: new URL('../../src', import.meta.url),
    prefix: `/src/${version}/`,
    decorateReply: false,
    immutable: true,
    maxAge: '1y',
    allowedPath: (pathName) => pathName.endsWith('.css') || pathName.endsWith('.js'),
  })

  app.get('/health', async () => ({status: 'ok', version}))
  // Everything below knows who the user is. It is a plugin, rather than a hook on the root
  // context, because an encapsulated hook is guaranteed to run *after* the `onRequest` hooks of
  // `@fastify/cookie` and `@fastify/request-context`, both of which it depends on.
  app.register(async (appWithUser) => {
    appWithUser.addHook(
      'onRequest',
      resolveUser(auth, (userId) => userSettings(db, userId)),
    )

    appWithUser.register(loginRoutes, {auth, firebaseConfig, db})
    appWithUser.register(languageRoutes, {db})

    // ...and everything in here additionally requires that there *be* a user, which makes routes
    // private by construction: a new route is only reachable without a session if it is
    // deliberately registered outside this plugin.
    appWithUser.register(async (privateApp) => {
      privateApp.addHook('onRequest', requireAuthentication)

      privateApp.register(expensesRoutes, {db, timeZone})
    })
  })

  return {app, db}
}
