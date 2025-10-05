import fastify from 'fastify'
import formbody from '@fastify/formbody'
import fastifystatic from '@fastify/static'
import qs from 'qs'
import postgres, {type Sql} from 'postgres'
import studentRoutes from '../domain/student/route.ts'
import productRoutes from '../domain/product/route.ts'
import salesEvents from '../domain/sales-event/route.ts'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import type {
  AcademyCourse,
  AcademyIntegrationService,
} from '@giltayar/carmel-tools-academy-integration/service'
import {fastifyRequestContext} from '@fastify/request-context'
import type {
  WhatsAppGroup,
  WhatsAppIntegrationService,
} from '@giltayar/carmel-tools-whatsapp-integration/service'
import type {
  SmooveList,
  SmooveIntegrationService,
} from '@giltayar/carmel-tools-smoove-integration/service'

declare module '@fastify/request-context' {
  interface RequestContextData {
    academyIntegration: AcademyIntegrationService
    whatsappIntegration: WhatsAppIntegrationService
    smooveIntegration: SmooveIntegrationService
    sql: Sql
    courses: AcademyCourse[] | undefined
    whatsappGroups: WhatsAppGroup[] | undefined
    smooveLists: SmooveList[] | undefined
    products: {id: number; name: string}[] | undefined
  }
}

export function makeApp({
  db: {host, port, username, password},
  academyIntegration,
  whatsappIntegration,
  smooveIntegration,
}: {
  db: {host: string; port: number; username: string; password: string}
  academyIntegration: AcademyIntegrationService
  whatsappIntegration: WhatsAppIntegrationService
  smooveIntegration: SmooveIntegrationService
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
    defaultStoreValues: {
      sql,
      academyIntegration,
      whatsappIntegration,
      smooveIntegration,
      courses: undefined,
      whatsappGroups: undefined,
      smooveLists: undefined,
      products: undefined,
    },
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
  app.register(salesEvents, {prefix: '/sales-events', sql})

  app.get('/health', async () => {
    return {status: 'ok'}
  })

  return {app, sql}
}
