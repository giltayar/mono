import fastify from 'fastify'
import formbody from '@fastify/formbody'
import fastifystatic from '@fastify/static'
import qs from 'qs'
import postgres, {type Sql} from 'postgres'
import studentRoutes from '../domain/student/route.ts'
import productRoutes from '../domain/product/route.ts'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import type {
  AcademyCourse,
  AcademyIntegrationService,
} from '@giltayar/carmel-tools-academy-integration/service'
import {fastifyRequestContext} from '@fastify/request-context'

declare module '@fastify/request-context' {
  interface RequestContextData {
    academyIntegration: AcademyIntegrationService
    sql: Sql
    courses: AcademyCourse[] | undefined
  }
}

export function makeApp({
  db: {host, port, username, password},
  academyIntegration,
}: {
  db: {host: string; port: number; username: string; password: string}
  academyIntegration: AcademyIntegrationService
}) {
  const app = fastify({logger: process.env.NODE_ENV !== 'test'})
  const sql = postgres({
    host,
    port,
    database: 'carmbo',
    username,
    password,
    transform: {...postgres.camel},
  })

  app.register(formbody, {parser: (str) => qs.parse(str)})
  app.register(fastifyRequestContext, {
    defaultStoreValues: {sql, academyIntegration, courses: undefined},
  })
  app.register(fastifystatic, {
    root: new URL('../../dist', import.meta.url),
    prefix: '/dist/',
    decorateReply: false,
  })
  app.register(fastifystatic, {
    root: new URL('../../src', import.meta.url),
    prefix: '/src/',
    decorateReply: false,
    allowedPath: (pathName) =>
      pathName.endsWith('scripts.js') ||
      pathName.endsWith('.css') ||
      pathName.endsWith('.png') ||
      pathName.endsWith('.svg'),
  })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.get('/', async (_, reply) => reply.redirect('/students'))

  app.register(studentRoutes, {prefix: '/students', sql})
  app.register(productRoutes, {prefix: '/products', sql})

  app.get('/health', async () => {
    return {status: 'ok'}
  })

  return {app, sql}
}
