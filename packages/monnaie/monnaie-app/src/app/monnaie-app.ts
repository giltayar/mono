import fastify, {type FastifyInstance} from 'fastify'
import formbody from '@fastify/formbody'
import fastifyStatic from '@fastify/static'
import cookie from '@fastify/cookie'
import {fastifyRequestContext} from '@fastify/request-context'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import calculatorRoutes from '../domain/calculator/route.ts'
import languageRoutes from '../domain/language/route.ts'
import authenticationRoutes from '../domain/authentication/route.ts'
import {prepareDatabase} from './prepare-database.ts'
import {createDb, type Db} from '../commons/db.ts'
import {initializeI18n, resolveLanguage, type Language} from '../commons/i18n.ts'
import {resolveUser, type Auth} from '../commons/auth.ts'
import {version} from '../commons/version.ts'

export async function makeApp({
  connectionString,
  language,
  auth,
  secureCookies = true,
}: {
  connectionString: string
  /** The language to use when the request asks for no language we support */
  language: Language
  auth: Auth
  /** Turned off only when serving over plain http, which in practice means the e2e tests */
  secureCookies?: boolean
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
  // a `preHandler` hook, and not an `onRequest` one, so that it needs no ordering against the two
  // plugins above: their own `onRequest` hooks have always run by the time `preHandler` does
  app.addHook('preHandler', resolveUser(auth))

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

  app.register(calculatorRoutes, {db})
  app.register(languageRoutes)
  app.register(authenticationRoutes, {auth, secureCookies})

  app.get('/health', async () => ({status: 'ok', version}))

  return {app, db}
}
