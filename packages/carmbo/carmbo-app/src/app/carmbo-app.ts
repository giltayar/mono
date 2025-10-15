import fastify, {type FastifyBaseLogger, type FastifyInstance} from 'fastify'
import formbody from '@fastify/formbody'
import fastifystatic from '@fastify/static'
import qs from 'qs'
import Auth0 from '@auth0/auth0-fastify'
import postgres, {type Sql} from 'postgres'
import studentRoutes from '../domain/student/route.ts'
import productRoutes from '../domain/product/route.ts'
import salesEvents from '../domain/sales-event/route.ts'
import salesRoutes from '../domain/sale/route.ts'
import {apiRoute as salesApiRoute} from '../domain/sale/route.ts'
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
import type {TEST_HookFunction} from '../commons/TEST_hooks.ts'

declare module '@fastify/request-context' {
  interface RequestContextData {
    academyIntegration: AcademyIntegrationService
    whatsappIntegration: WhatsAppIntegrationService
    smooveIntegration: SmooveIntegrationService
    logger: FastifyBaseLogger
    sql: Sql
    courses: AcademyCourse[] | undefined
    whatsappGroups: WhatsAppGroup[] | undefined
    smooveLists: SmooveList[] | undefined
    products: {id: number; name: string}[] | undefined
    TEST_hooks: Record<string, TEST_HookFunction> | undefined
  }
}

export function makeApp({
  db: {database, host, port, username, password},
  services: {academyIntegration, whatsappIntegration, smooveIntegration},
  auth0,
  appBaseUrl,
  TEST_hooks,
}: {
  db: {database: string; host: string; port: number; username: string; password: string}
  services: {
    academyIntegration: AcademyIntegrationService
    whatsappIntegration: WhatsAppIntegrationService
    smooveIntegration: SmooveIntegrationService
  }
  auth0:
    | {
        domain: string
        clientId: string
        clientSecret: string
        sessionSecret: string
      }
    | undefined
  appBaseUrl: string
  TEST_hooks?: Record<string, TEST_HookFunction>
}) {
  const app = fastify({logger: process.env.NODE_ENV !== 'test'})
  const sql = postgres({
    host,
    port,
    database,
    username,
    password,
    transform: {...postgres.camel},
    ssl: host.includes('neon') ? 'require' : undefined,
    //debug: console.log,
  })

  app.register(formbody, {parser: (str) => qs.parse(str)})
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.register(fastifyRequestContext, {
    defaultStoreValues: (request) => ({
      sql,
      academyIntegration,
      whatsappIntegration,
      smooveIntegration,
      courses: undefined,
      logger: request.log,
      whatsappGroups: undefined,
      smooveLists: undefined,
      products: undefined,
      TEST_hooks,
    }),
  })

  if (auth0) {
    app.register(Auth0, {...auth0, appBaseUrl})
  }

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

  app.get('/', async (_, reply) => reply.redirect('/students'))

  app.register((app) => {
    addAuth0Hook(app, app.auth0Client)

    app.register(studentRoutes, {prefix: '/students', sql})
    app.register(productRoutes, {prefix: '/products', sql})
    app.register(salesEvents, {
      prefix: '/sales-events',
      sql,
      appBaseUrl,
      apiSecret: auth0?.sessionSecret,
    })
    app.register(salesRoutes, {prefix: '/sales', sql})
  })

  app.register(salesApiRoute, {prefix: '/api/sales', secret: auth0?.sessionSecret})

  app.get('/health', async () => ({status: 'ok'}))

  return {app, sql}
}

function addAuth0Hook(app: FastifyInstance, auth0Client: any) {
  if (auth0Client)
    app.addHook('preHandler', async function hasSessionPreHandler(request, reply) {
      const session = await auth0Client.getSession({request, reply})

      if (!session) {
        reply.redirect('/auth/login')
      }
    })
}
