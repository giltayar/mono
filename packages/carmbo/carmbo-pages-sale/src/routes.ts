import fastifyStatic from '@fastify/static'
import {requestContext} from '@fastify/request-context'
import type {FastifyInstance} from 'fastify'
import productRoutes from './domain/product/route.ts'
import salesEventRoutes from './domain/sales-event/route.ts'
import saleRoutes, {
  apiRoute as saleApiRoutes,
  landingPageApiRoute as saleLandingPageRoutes,
} from './domain/sale/route.ts'
import smooveRoutes from './domain/smoove/route.ts'
import ravmesserRoutes from './domain/ravmesser/route.ts'
import whatsappRoutes from './domain/whatsapp/route.ts'
import academyRoutes from './domain/academy/route.ts'
import {registerSaleLocaleResources} from './locale-resources.ts'
import type {SaleRouteOptions} from './route-options.ts'

export type {SaleRouteOptions} from './route-options.ts'

function registerRequestContext(app: FastifyInstance, options: SaleRouteOptions): void {
  app.addHook('onRequest', (request, _reply, done) => {
    requestContext.set('sql', options.sql)
    requestContext.set('academyIntegration', options.academyIntegration)
    requestContext.set('academyAccountSubdomains', options.academyAccountSubdomains)
    requestContext.set('whatsappIntegration', options.whatsappIntegration)
    requestContext.set('smooveIntegration', options.smooveIntegration)
    requestContext.set('ravmesserIntegration', options.ravmesserIntegration)
    requestContext.set('cardcomIntegration', options.cardcomIntegration)
    requestContext.set('skoolIntegration', options.skoolIntegration)
    requestContext.set('nowService', options.nowService)
    requestContext.set('logger', request.log)
    requestContext.set('whatsappGroups', undefined)
    requestContext.set('smooveLists', undefined)
    requestContext.set('ravmesserLists', undefined)
    requestContext.set('products', undefined)
    requestContext.set('TEST_hooks', options.TEST_hooks)
    done()
  })
}

export function pageRoutes(app: FastifyInstance, options: SaleRouteOptions): void {
  registerSaleLocaleResources()
  registerRequestContext(app, options)

  app.register(fastifyStatic, {
    root: new URL('./domain', import.meta.url),
    prefix: '/sale-assets/',
    decorateReply: false,
    immutable: true,
    maxAge: '1y',
    allowedPath: (pathName) => pathName.endsWith('.js') || pathName.endsWith('.css'),
  })
  app.register(productRoutes, {
    prefix: '/products',
    sql: options.sql,
    appBaseUrl: options.appBaseUrl,
  })
  app.register(salesEventRoutes, {
    prefix: '/sales-events',
    ...options,
  })
  app.register(saleRoutes, {prefix: '/sales', sql: options.sql})
  app.register(smooveRoutes, {prefix: '/smoove'})
  app.register(ravmesserRoutes, {prefix: '/ravmesser'})
  app.register(whatsappRoutes, {prefix: '/whatsapp'})
  app.register(academyRoutes, {prefix: '/academy'})
}

export function apiRoutes(app: FastifyInstance, options: SaleRouteOptions): void {
  registerSaleLocaleResources()
  registerRequestContext(app, options)
  app.register(saleApiRoutes, {prefix: '/api/sales', secret: options.apiSecret, ...options})
}

export function landingPageRoutes(app: FastifyInstance, options: SaleRouteOptions): void {
  registerSaleLocaleResources()
  registerRequestContext(app, options)
  app.register(saleLandingPageRoutes, {prefix: '/landing-page/sales'})
}
