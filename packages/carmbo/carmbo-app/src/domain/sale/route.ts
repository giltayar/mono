import type {FastifyInstance} from 'fastify'
import {z} from 'zod'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import type {Sql} from 'postgres'
import {
  dealWithCardcomOneTimeSale,
  refundSale,
  disconnectSale,
  showSales,
  showSale,
  showSaleInHistory,
  showSaleCreate,
  showOngoingSale,
  showSaleProviders,
  showSalesEventList,
  showStudentList,
  showProductList,
  createSale,
  updateSale,
  deleteSale,
  connectSale,
  dealWithCardcomRecurringPayment,
  showSalePayments,
  cancelSubscription,
  dealWithNoInvoiceSale,
} from './controller.ts'
import {
  dealWithControllerResult,
  dealWithControllerResultAsync,
} from '../../commons/routes-commons.ts'
import {NewSaleSchema, SaleSchema} from './model/model.ts'
import assert from 'node:assert'
import {
  CardcomRecurringOrderWebHookJsonSchema,
  CardcomSaleWebhookJsonSchema,
} from '@giltayar/carmel-tools-cardcom-integration/types'
import {initializeJobHandlers as initializeSaleJobHandlers} from './model/model-connect.ts'
import {initializeJobHandlers as initializeStandingOrderJobHandlers} from './model/model-standing-order.ts'
import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import type {NowService} from '../../commons/now-service.ts'
import type {WhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'

export function apiRoute(
  app: FastifyInstance,
  {
    secret,
    smooveIntegration,
    academyIntegration,
    whatsappIntegration,
    nowService,
  }: {
    secret: string | undefined
    smooveIntegration: SmooveIntegrationService
    academyIntegration: AcademyIntegrationService
    whatsappIntegration: WhatsAppIntegrationService
    nowService: NowService
  },
) {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  initializeSaleJobHandlers(academyIntegration, smooveIntegration)
  initializeStandingOrderJobHandlers(
    academyIntegration,
    smooveIntegration,
    whatsappIntegration,
    nowService,
  )

  for (const path of ['/cardcom/sale', '/cardcom/one-time-sale'])
    appWithTypes.post(
      path,
      {
        schema: {
          querystring: z.object({secret: z.string(), 'sales-event': z.coerce.number().positive()}),
          body: CardcomSaleWebhookJsonSchema,
        },
      },
      async (request, reply) => {
        if (secret && request.query.secret !== secret) {
          request.log.warn({query: request.query}, 'wrong-api-secret')
          return reply.status(403).send({error: 'Forbidden'})
        }

        request.log.info({body: request.body}, 'cardcom-sale-webhook')

        return await dealWithControllerResultAsync(reply, () =>
          dealWithCardcomOneTimeSale(request.body, request.query['sales-event']),
        )
      },
    )

  appWithTypes.post(
    '/cardcom/recurring-payment',
    {
      schema: {
        querystring: z.object({secret: z.string()}),
        body: CardcomRecurringOrderWebHookJsonSchema,
      },
    },
    async (request, reply) => {
      if (secret && request.query.secret !== secret) {
        request.log.warn({query: request.query}, 'wrong-api-secret')
        return reply.status(403).send({error: 'Forbidden'})
      }

      request.log.info({body: request.body}, 'cardcom-recurring-payment-webhook')

      return await dealWithControllerResultAsync(reply, () =>
        dealWithCardcomRecurringPayment(request.body),
      )
    },
  )

  appWithTypes.get(
    '/no-invoice-sale',
    {
      schema: {
        querystring: z.object({
          secret: z.string(),
          'sales-event': z.coerce.number().positive(),
          email: z.email(),
          phone: z.string().optional(),
          cellPhone: z.string().optional(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      if (secret && request.query.secret !== secret) {
        request.log.warn({query: request.query}, 'wrong-api-secret')
        return reply.status(403).send({error: 'Forbidden'})
      }

      request.log.info({query: request.query}, 'no-invoice-sale-request')

      return await dealWithControllerResult(
        reply,
        await dealWithNoInvoiceSale({
          salesEventNumber: request.query['sales-event'],
          email: request.query.email,
          phone: request.query.phone,
          cellPhone: request.query.cellPhone,
          firstName: request.query.firstName,
          lastName: request.query.lastName,
        }),
      )
    },
  )
}

export function landingPageApiRoute(app: FastifyInstance) {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.get(
    '/cancel-subscription',
    {
      schema: {
        querystring: z.object({
          'sales-event': z.coerce.number().positive(),
          email: z.string().email(),
        }),
      },
    },
    async (request, reply) => {
      const {'sales-event': salesEventNumber, email} = request.query

      await dealWithControllerResult(
        reply,
        await cancelSubscription(email, Number(salesEventNumber)),
      )
    },
  )
}

export default function (app: FastifyInstance, {sql}: {sql: Sql}) {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  // List sales
  appWithTypes.get(
    '/',
    {
      schema: {
        querystring: z
          .object({
            flash: z.string(),
            'with-archived': z.string(),
            q: z.string(),
            page: z.coerce.number().int().min(0).default(0).optional(),
          })
          .partial(),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showSales(
          {
            flash: request.query.flash,
            withArchived: 'with-archived' in request.query,
            query: request.query.q,
            page: request.query.page ?? 0,
          },
          sql,
        ),
      ),
  )

  // Create new sale
  appWithTypes.get('/new', async (_request, reply) =>
    dealWithControllerResult(reply, await showSaleCreate(undefined)),
  )
  appWithTypes.post('/new', {schema: {body: NewSaleSchema}}, async (request, reply) =>
    dealWithControllerResult(reply, await showOngoingSale(request.body)),
  )

  appWithTypes.post('/', {schema: {body: NewSaleSchema}}, async (request, reply) =>
    dealWithControllerResult(reply, await createSale(request.body, sql)),
  )

  appWithTypes.get(
    '/query/sales-event-list',
    {schema: {querystring: z.object({q: z.string().optional()})}},
    async (request, reply) =>
      dealWithControllerResult(reply, await showSalesEventList(request.query.q)),
  )

  appWithTypes.get(
    '/query/student-list',
    {schema: {querystring: z.object({q: z.string().optional()})}},
    async (request, reply) =>
      dealWithControllerResult(reply, await showStudentList(request.query.q)),
  )

  appWithTypes.get(
    '/query/product-list',
    {schema: {querystring: z.object({q: z.string().optional()})}},
    async (request, reply) =>
      dealWithControllerResult(reply, await showProductList(request.query.q)),
  )

  // View sale
  appWithTypes.get(
    '/:number',
    {schema: {params: z.object({number: z.coerce.number().int()})}},
    async (request, reply) => {
      return dealWithControllerResult(reply, await showSale(request.params.number, undefined, sql))
    },
  )

  // View sale payments
  appWithTypes.get(
    '/:number/payments',
    {schema: {params: z.object({number: z.coerce.number().int()})}},
    async (request, reply) => {
      return dealWithControllerResult(reply, await showSalePayments(request.params.number, sql))
    },
  )
  // View sale providers
  appWithTypes.get(
    '/:number/providers',
    {schema: {params: z.object({number: z.coerce.number().int()})}},
    async (request, reply) => {
      return dealWithControllerResult(reply, await showSaleProviders(request.params.number, sql))
    },
  )

  appWithTypes.post('/:number', {schema: {body: NewSaleSchema}}, async (request, reply) =>
    dealWithControllerResult(reply, await showOngoingSale(request.body)),
  )

  // Update sale
  appWithTypes.put(
    '/:number',
    {schema: {body: SaleSchema, params: z.object({number: z.coerce.number().int()})}},
    async (request, reply) => {
      const saleNumber = request.params.number

      assert(saleNumber === request.body.saleNumber, 'sale number in URL must match ID in body')

      return dealWithControllerResult(reply, await updateSale(request.body, sql))
    },
  )

  appWithTypes.post(
    '/:number/connect',
    {schema: {body: SaleSchema, params: z.object({number: z.coerce.number()})}},
    async (request, reply) => {
      const saleNumber = request.params.number

      return dealWithControllerResultAsync(reply, () => connectSale(saleNumber, request.body))
    },
  )
  appWithTypes.post(
    '/:number/refund',
    {schema: {params: z.object({number: z.coerce.number()})}},
    async (request, reply) => {
      const saleNumber = request.params.number

      return dealWithControllerResultAsync(reply, () => refundSale(saleNumber))
    },
  )

  appWithTypes.post(
    '/:number/disconnect',
    {schema: {params: z.object({number: z.coerce.number()})}},
    async (request, reply) => {
      const saleNumber = request.params.number

      return dealWithControllerResultAsync(reply, () => disconnectSale(saleNumber))
    },
  )

  // View sale in history
  appWithTypes.get(
    '/:number/by-history/:historyId',
    {
      schema: {
        params: z.object({number: z.coerce.number().int(), historyId: z.string().uuid()}),
      },
    },
    async (request, reply) => {
      return dealWithControllerResult(
        reply,
        await showSaleInHistory(request.params.number, request.params.historyId, sql),
      )
    },
  )

  // Delete (Archive) sale
  appWithTypes.delete(
    '/:number',
    {
      schema: {
        params: z.object({number: z.coerce.number().int()}),
        querystring: z.object({operation: z.enum(['delete', 'restore'])}),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await deleteSale(request.params.number, request.query.operation, sql),
      ),
  )
}
