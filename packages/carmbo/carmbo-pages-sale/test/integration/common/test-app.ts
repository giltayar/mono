import formbody from '@fastify/formbody'
import {fastifyRequestContext} from '@fastify/request-context'
import fastifyStatic from '@fastify/static'
import {layoutAssetRoutes} from '@giltayar/carmbo-commons/layout/assets'
import {initializeJobExecutor} from '@giltayar/carmbo-pages-job/jobs/executor'
import {apiRoutes as jobApiRoutes, routes as jobRoutes} from '@giltayar/carmbo-pages-job/routes'
import {routes as studentRoutes} from '@giltayar/carmbo-pages-student/routes'
import fastify, {type FastifyInstance} from 'fastify'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import {fileURLToPath} from 'node:url'
import qs from 'qs'
import {
  apiRoutes,
  landingPageRoutes,
  pageRoutes,
  type SaleRouteOptions,
} from '../../../src/routes.ts'

export function createTestApp(options: SaleRouteOptions): FastifyInstance {
  const app = fastify()

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
      TEST_hooks: options.TEST_hooks,
    }),
  })
  app.register(layoutAssetRoutes)
  app.register(fastifyStatic, {
    root: [
      fileURLToPath(new URL('../../../node_modules/bootstrap/dist/css', import.meta.url)),
      fileURLToPath(new URL('../../../node_modules/bootstrap/dist/js', import.meta.url)),
      fileURLToPath(new URL('../../../node_modules/htmx.org/dist', import.meta.url)),
    ],
    prefix: '/dist/1.0.0/',
    decorateReply: false,
  })

  initializeJobExecutor(options.sql, app.log)
  app.register(studentRoutes, {
    prefix: '/students',
    sql: options.sql,
    academyIntegration: options.academyIntegration,
    academyAccountSubdomains: options.academyAccountSubdomains,
    smooveIntegration: options.smooveIntegration,
    ravmesserIntegration: options.ravmesserIntegration,
    nowService: options.nowService,
  })
  app.register(pageRoutes, options)
  app.register(apiRoutes, options)
  app.register(landingPageRoutes, options)
  app.register(jobRoutes, {prefix: '/jobs', sql: options.sql})
  app.register(jobApiRoutes, {
    prefix: '/api/jobs',
    secret: options.apiSecret,
    nowService: options.nowService,
  })
  app.get('/', async (_request, reply) => reply.redirect('/sales'))

  return app
}
