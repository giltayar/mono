import type {FastifyInstance} from 'fastify'
import {z} from 'zod'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import type {Sql} from 'postgres'
import {CardcomSaleWebhookJsonSchema} from './model-cardcom-sale.ts'
import {
  dealWithCardcomOneTimeSale,
  showSales,
  showSale,
  showSaleInHistory,
  showSaleCreate,
  showOngoingSaleCreate,
  showSalesEventList,
  showStudentList,
  showProductList,
  createSale,
  updateSale,
  deleteSale,
} from './controller.ts'
import {
  dealWithControllerResult,
  dealWithControllerResultAsync,
} from '../../commons/routes-commons.ts'
import {NewSaleSchema, SaleSchema} from './model.ts'
import assert from 'node:assert'

export function apiRoute(app: FastifyInstance, {secret}: {secret: string | undefined}) {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.post(
    '/cardcom/one-time-sale',
    {
      schema: {
        querystring: z.object({secret: z.string(), 'sales-event': z.coerce.number().positive()}),
        body: CardcomSaleWebhookJsonSchema,
      },
    },
    async (request, reply) => {
      if (secret && request.query.secret !== secret) {
        request.log.warn({query: request.query}, 'cardcom-one-time-sale-wrong-secret')
        return reply.status(403).send({error: 'Forbidden'})
      }

      request.log.info({body: request.body}, 'cardcom-one-time-sale-webhook')

      return await dealWithControllerResultAsync(reply, () =>
        dealWithCardcomOneTimeSale(request.body, request.query['sales-event']),
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
    dealWithControllerResult(reply, await showOngoingSaleCreate(request.body)),
  )

  appWithTypes.post('/', {schema: {body: NewSaleSchema}}, async (request, reply) => {
    return dealWithControllerResult(reply, await createSale(request.body, sql))
  })

  appWithTypes.get(
    '/query/sales-event-list',
    {schema: {querystring: z.object({q: z.string().optional()})}},
    async (request, reply) => {
      return dealWithControllerResult(reply, await showSalesEventList(request.query.q))
    },
  )

  appWithTypes.get(
    '/query/student-list',
    {schema: {querystring: z.object({q: z.string().optional()})}},
    async (request, reply) => {
      return dealWithControllerResult(reply, await showStudentList(request.query.q))
    },
  )

  appWithTypes.get(
    '/query/product-list',
    {schema: {querystring: z.object({q: z.string().optional()})}},
    async (request, reply) => {
      return dealWithControllerResult(reply, await showProductList(request.query.q))
    },
  )

  // View sale
  appWithTypes.get(
    '/:number',
    {schema: {params: z.object({number: z.coerce.number().int()})}},
    async (request, reply) => {
      return dealWithControllerResult(reply, await showSale(request.params.number, sql))
    },
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
        querystring: z.object({'delete-operation': z.enum(['delete', 'restore'])}),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await deleteSale(request.params.number, request.query['delete-operation'], sql),
      ),
  )
}
