import fastify, {type FastifyInstance} from 'fastify'
import formbody from '@fastify/formbody'
import fastifyStatic from '@fastify/static'
import cookie from '@fastify/cookie'
import {fastifyRequestContext} from '@fastify/request-context'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import calculatorRoutes from '../domain/calculator/route.ts'
import languageRoutes from '../domain/language/route.ts'
import {prepareDatabase} from './prepare-database.ts'
import {createDb, type Db} from '../commons/db.ts'
import {initializeI18n, resolveLanguage, type Language} from '../commons/i18n.ts'
import {version} from '../commons/version.ts'

export async function makeApp({
  connectionString,
  language,
}: {
  connectionString: string
  /** The language to use when the request asks for no language we support */
  language: Language
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
    defaultStoreValues: (request) => ({language: resolveLanguage(request)}),
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

  app.register(calculatorRoutes, {db})
  app.register(languageRoutes)

  app.get('/health', async () => ({status: 'ok', version}))

  return {app, db}
}
