import formbody from '@fastify/formbody'
import {fastifyRequestContext} from '@fastify/request-context'
import fastifyStatic from '@fastify/static'
import {initializei18next} from '@giltayar/carmbo-commons/commons/i18next-utils'
import {setUiConfiguration} from '@giltayar/carmbo-commons/commons/ui-configuration'
import {setVersion} from '@giltayar/carmbo-commons/commons/version'
import {layoutAssetRoutes} from '@giltayar/carmbo-commons/layout/assets'
import {initializeJobExecutor} from '@giltayar/carmbo-pages-job/jobs/executor'
import {apiRoutes as jobApiRoutes, routes as jobRoutes} from '@giltayar/carmbo-pages-job/routes'
import {routes as studentRoutes} from '@giltayar/carmbo-pages-student/routes'
import fastify, {type FastifyInstance} from 'fastify'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import type {Sql} from 'postgres'
import qs from 'qs'
import packageJson from '../package.json' with {type: 'json'}
import {apiRoutes, landingPageRoutes, pageRoutes, type SaleRouteOptions} from '../src/routes.ts'
import type {createFakes} from './fakes.ts'

export async function createApp(
  database: Sql,
  fakes: ReturnType<typeof createFakes>,
): Promise<FastifyInstance> {
  const language = process.env.LANGUAGE === 'he' ? 'he' : 'en'
  await initializei18next(language)
  setVersion(packageJson.version)
  setUiConfiguration(language === 'he' ? 'liraz' : 'carmel')

  const app = fastify({logger: true})
  const options: SaleRouteOptions = {
    sql: database,
    appBaseUrl: 'http://127.0.0.1:3001',
    apiSecret: undefined,
    academyIntegration: fakes.academyIntegration,
    academyAccountSubdomains: ['carmel'],
    whatsappIntegration: fakes.whatsappIntegration,
    smooveIntegration: fakes.smooveIntegration,
    ravmesserIntegration: fakes.ravmesserIntegration,
    cardcomIntegration: fakes.cardcomIntegration,
    skoolIntegration: fakes.skoolIntegration,
    nowService: () => new Date(),
  }

  app.register(formbody, {parser: (body) => qs.parse(body)})
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.register(fastifyRequestContext, {
    defaultStoreValues: (request) => ({
      ...options,
      logger: request.log,
      whatsappGroups: undefined,
      smooveLists: undefined,
      ravmesserLists: undefined,
      products: undefined,
      TEST_hooks: undefined,
    }),
  })
  app.register(layoutAssetRoutes)
  app.register(fastifyStatic, {
    root: new URL('./dist', import.meta.url),
    prefix: `/dist/${packageJson.version}/`,
    decorateReply: false,
    immutable: true,
    maxAge: '1y',
  })

  initializeJobExecutor(database, app.log)
  app.register(studentRoutes, {
    prefix: '/students',
    sql: database,
    academyIntegration: options.academyIntegration,
    academyAccountSubdomains: options.academyAccountSubdomains,
    smooveIntegration: options.smooveIntegration,
    ravmesserIntegration: options.ravmesserIntegration,
    nowService: options.nowService,
  })
  app.register(pageRoutes, options)
  app.register(apiRoutes, options)
  app.register(landingPageRoutes, options)
  app.register(jobRoutes, {prefix: '/jobs', sql: database})
  app.register(jobApiRoutes, {
    prefix: '/api/jobs',
    secret: undefined,
    nowService: options.nowService,
  })
  app.get('/', async (_request, reply) => reply.redirect('/sales'))

  return app
}
