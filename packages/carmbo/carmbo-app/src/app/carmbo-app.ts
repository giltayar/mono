import {setupFastifyErrorHandler} from '@sentry/node'
import fastify from 'fastify'
import formbody from '@fastify/formbody'
import fastifyStatic from '@fastify/static'
import qs from 'qs'
import fastifyCookie from '@fastify/cookie'
import fastifyCompress from '@fastify/compress'
import postgres from 'postgres'
import {routes as studentRoutes} from '@giltayar/carmbo-pages-student/routes'
import {routes as communityRoutes} from '@giltayar/carmbo-pages-community/routes'
import {handleRegistrationEmailResult} from '@giltayar/carmbo-pages-community/registration-email'
import {routes as emailRoutes} from '@giltayar/carmbo-pages-email/routes'
import {webhookRoutes as emailWebhookRoutes} from '@giltayar/carmbo-pages-email/webhook-routes'
import {registerSendEmailJobHandler} from '@giltayar/carmbo-pages-email/jobs'
import type {EmailService} from '@giltayar/carmbo-pages-email/service'
import {
  apiRoutes as saleApiRoutes,
  landingPageRoutes as saleLandingPageRoutes,
  pageRoutes as salePageRoutes,
} from '@giltayar/carmbo-pages-sale/routes'
import {routes as authRoutes, useFirebaseAuth} from '@giltayar/carmbo-pages-auth'
import {apiRoutes as jobsApiRoutes, routes as jobsRoutes} from '@giltayar/carmbo-pages-job/routes'
import backupRoutes from '../domain/backup/route.ts'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import {fastifyRequestContext} from '@fastify/request-context'
import type {WhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'
import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {RavmesserIntegrationService} from '@giltayar/carmel-tools-ravmesser-integration/service'
import type {TEST_HookFunction} from '@giltayar/carmbo-commons/commons/TEST_hooks'
import type {CardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import type {SkoolIntegrationService} from '@giltayar/carmel-tools-skool-integration/service'
import {initializeJobExecutor} from '@giltayar/carmbo-pages-job/jobs/executor'
import {setVersion} from '@giltayar/carmbo-commons/commons/version'
import {setUiConfiguration} from '@giltayar/carmbo-commons/commons/ui-configuration'
import {layoutAssetRoutes} from '@giltayar/carmbo-commons/layout/assets'
import packageJson from '../../package.json' with {type: 'json'}

const RESEND_WEBHOOK_ROUTE_PREFIX = '/api/emails/resend'
// The webhook routes serve POST `<prefix>/webhook`.
export const RESEND_WEBHOOK_PATH = `${RESEND_WEBHOOK_ROUTE_PREFIX}/webhook`

// Communities send registration emails, so enabling them requires the email configuration.
export type CommunitiesConfiguration = {
  emailService: EmailService
  webhookSigningSecret: string
  emailFrom: string
  emailLanguage: 'en' | 'he'
}

export function makeApp({
  db: {connectionString, database, host, port, username, password, backupFile},
  services: {
    academyIntegration,
    academyAccountSubdomains,
    whatsappIntegration,
    smooveIntegration,
    ravmesserIntegration,
    cardcomIntegration,
    skoolIntegration,
    nowService,
  },
  firebase,
  apiSecret,
  appBaseUrl,
  uiConfiguration,
  communities,
  TEST_hooks,
}: {
  db: {
    connectionString: string | undefined
    database: string
    host: string
    port: number
    username: string
    password: string
    backupFile: string | undefined
  }
  services: {
    cardcomIntegration: CardcomIntegrationService
    whatsappIntegration: WhatsAppIntegrationService
    academyIntegration: AcademyIntegrationService | undefined
    academyAccountSubdomains: string[] | undefined
    smooveIntegration: SmooveIntegrationService | undefined
    ravmesserIntegration: RavmesserIntegrationService | undefined
    skoolIntegration: SkoolIntegrationService | undefined
    nowService: () => Date
  }
  firebase:
    | {
        apiKey: string
        serviceAccountJson: string
      }
    | undefined
  apiSecret: string | undefined
  appBaseUrl: string
  uiConfiguration: string
  communities: CommunitiesConfiguration | undefined
  TEST_hooks?: Record<string, TEST_HookFunction>
}) {
  const version = packageJson.version
  setVersion(version)
  setUiConfiguration(uiConfiguration, {withCommunities: !!communities})

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
        ssl: process.env.NODE_ENV === 'production' ? 'require' : undefined,
        ...postgresJsOptions,
      })
  const saleRouteOptions = {
    sql,
    appBaseUrl,
    apiSecret,
    academyIntegration,
    academyAccountSubdomains,
    whatsappIntegration,
    smooveIntegration,
    ravmesserIntegration,
    cardcomIntegration,
    skoolIntegration,
    nowService,
    TEST_hooks,
  }
  initializeJobExecutor(sql, app.log)
  const registrationEmail = communities
    ? {
        queueEmail: registerSendEmailJobHandler({
          sql,
          nowService,
          emailService: communities.emailService,
          resultHandlers: {'registration-email': handleRegistrationEmailResult},
        }),
        from: communities.emailFrom,
        language: communities.emailLanguage,
      }
    : undefined
  setupFastifyErrorHandler(app)

  app.register(formbody, {parser: (str) => qs.parse(str)})
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.register(fastifyRequestContext, {
    defaultStoreValues: (request) => ({
      sql,
      academyIntegration,
      academyAccountSubdomains,
      whatsappIntegration,
      smooveIntegration,
      ravmesserIntegration,
      skoolIntegration,
      cardcomIntegration,
      nowService,
      logger: request.log,
      whatsappGroups: undefined,
      smooveLists: undefined,
      ravmesserLists: undefined,
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
  app.register(layoutAssetRoutes)

  if (firebase) {
    app.register(authRoutes, {prefix: '/auth', firebase})
  }

  app.get('/', async (_, reply) => reply.redirect('/sales'))

  app.register((app) => {
    if (firebase) {
      useFirebaseAuth(app)
    }

    app.register(studentRoutes, {
      prefix: '/students',
      sql,
      academyIntegration,
      academyAccountSubdomains,
      smooveIntegration,
      ravmesserIntegration,
      nowService,
    })
    if (registrationEmail && communities) {
      app.register(communityRoutes, {prefix: '/communities', sql, nowService, registrationEmail})
      app.register(emailRoutes, {
        prefix: '/emails',
        sql,
        nowService,
        emailService: communities.emailService,
        from: communities.emailFrom,
      })
    }
    app.register(salePageRoutes, saleRouteOptions)
    app.register(jobsRoutes, {prefix: '/jobs', sql})
  })

  app.register(saleApiRoutes, saleRouteOptions)
  if (communities) {
    // Outside authentication: Resend calls it, and each request is verified by its signature.
    app.register(emailWebhookRoutes, {
      prefix: RESEND_WEBHOOK_ROUTE_PREFIX,
      sql,
      signingSecret: communities.webhookSigningSecret,
    })
  }
  app.register(jobsApiRoutes, {
    prefix: '/api/jobs',
    secret: apiSecret,
    nowService,
  })

  app.register(backupRoutes, {
    prefix: '/backup',
    secret: apiSecret,
    connectionString,
    backupFile,
  })

  app.register(saleLandingPageRoutes, saleRouteOptions)

  app.get('/health', async () => ({status: 'ok', version}))
  app.get('/bad-health', async (request) => {
    request.log.info('bad-health-endpoint')
    throw new Error('bad health')
  })

  return {app, sql}
}
