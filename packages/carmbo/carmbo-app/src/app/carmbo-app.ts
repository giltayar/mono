import fastify, {type FastifyBaseLogger} from 'fastify'
import formbody from '@fastify/formbody'
import fastifyStatic from '@fastify/static'
import qs from 'qs'
import fastifyCookie from '@fastify/cookie'
import fastifyCompress from '@fastify/compress'
import postgres, {type Sql} from 'postgres'
import studentRoutes from '../domain/student/route.ts'
import productRoutes from '../domain/product/route.ts'
import salesEvents from '../domain/sales-event/route.ts'
import salesRoutes, {
  landingPageApiRoute as salesLandingPageApiRoute,
  apiRoute as salesApiRoute,
} from '../domain/sale/route.ts'
import authRoutes, {useFirebaseAuth} from '../domain/auth/route.ts'
import jobsRoute, {apiRoute as jobsApiRoute} from '../domain/job/route.ts'
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
import type {CardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import {initializeJobExecutor} from '../domain/job/job-executor.ts'
import {version} from '../commons/version.ts'

declare module '@fastify/request-context' {
  interface RequestContextData {
    cardcomIntegration: CardcomIntegrationService
    whatsappIntegration: WhatsAppIntegrationService
    academyIntegration: AcademyIntegrationService | undefined
    smooveIntegration: SmooveIntegrationService | undefined
    nowService: () => Date
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
  db: {connectionString, database, host, port, username, password},
  services: {
    academyIntegration,
    whatsappIntegration,
    smooveIntegration,
    cardcomIntegration,
    nowService,
  },
  firebase,
  apiSecret,
  appBaseUrl,
  TEST_hooks,
}: {
  db: {
    connectionString: string | undefined
    database: string
    host: string
    port: number
    username: string
    password: string
  }
  services: {
    cardcomIntegration: CardcomIntegrationService
    whatsappIntegration: WhatsAppIntegrationService
    academyIntegration: AcademyIntegrationService | undefined
    smooveIntegration: SmooveIntegrationService | undefined
    nowService: () => Date
  }
  firebase:
    | {
        apiKey: string
      }
    | undefined
  apiSecret: string | undefined
  appBaseUrl: string
  TEST_hooks?: Record<string, TEST_HookFunction>
}) {
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

  const postgresJsOptions = {
    transform: {...postgres.camel},
    // debug: console.log,
  }
  const sql = connectionString
    ? postgres(connectionString, postgresJsOptions)
    : postgres({
        host,
        port,
        database,
        username,
        password,
        ssl: host.includes('neon') ? 'require' : undefined,
        ...postgresJsOptions,
      })
  initializeJobExecutor(sql, app.log)

  app.register(formbody, {parser: (str) => qs.parse(str)})
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.register(fastifyRequestContext, {
    defaultStoreValues: (request) => ({
      sql,
      academyIntegration,
      whatsappIntegration,
      smooveIntegration,
      cardcomIntegration,
      nowService,
      courses: undefined,
      logger: request.log,
      whatsappGroups: undefined,
      smooveLists: undefined,
      products: undefined,
      TEST_hooks,
    }),
  })

  app.register(fastifyCookie)

  app.register(fastifyCompress)

  app.register(fastifyStatic, {
    root: new URL('../../dist', import.meta.url),
    prefix: '/dist/' + version + '/',
    decorateReply: false,
    immutable: true,
    maxAge: '1y',
  })
  app.register(fastifyStatic, {
    root: new URL('../../src', import.meta.url),
    prefix: '/src/' + version + '/',
    decorateReply: false,
    immutable: true,
    maxAge: '1y',
    allowedPath: (pathName) =>
      pathName.endsWith('scripts.js') ||
      pathName.endsWith('.css') ||
      pathName.endsWith('.png') ||
      pathName.endsWith('.svg'),
  })

  if (firebase) {
    app.register(authRoutes, {prefix: '/auth', firebase})
  }

  app.get('/', async (_, reply) => reply.redirect('/sales'))

  app.register((app) => {
    if (firebase) {
      useFirebaseAuth(app)
    }

    app.register(studentRoutes, {prefix: '/students', sql})
    app.register(productRoutes, {prefix: '/products', sql})
    app.register(salesEvents, {
      prefix: '/sales-events',
      sql,
      smooveIntegration,
      academyIntegration,
      whatsappIntegration,
      appBaseUrl,
      apiSecret,
      nowService,
    })
    app.register(salesRoutes, {prefix: '/sales', sql})
    app.register(jobsRoute, {prefix: '/jobs', sql})
  })

  app.register(salesApiRoute, {
    prefix: '/api/sales',
    secret: apiSecret,
    sql,
    academyIntegration,
    smooveIntegration,
    whatsappIntegration,
    nowService,
  })
  app.register(jobsApiRoute, {
    prefix: '/api/jobs',
    secret: apiSecret,
  })

  app.register(salesLandingPageApiRoute, {
    prefix: '/landing-page/sales',
  })

  app.get('/health', async () => ({status: 'ok', version}))

  return {app, sql}
}
