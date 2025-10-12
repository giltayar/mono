import type {FastifyInstance} from 'fastify'
import {z} from 'zod'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import type {Sql} from 'postgres'
import {CardcomSaleWebhookJsonSchema} from './model.ts'
import {dealWithCardcomOneTimeSale, showSales, showSale, showSaleInHistory} from './controller.ts'
import {
  dealWithControllerResult,
  dealWithControllerResultAsync,
} from '../../commons/routes-commons.ts'

export function apiRoute(app: FastifyInstance, {secret}: {secret: string}) {
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
      if (request.query.secret !== secret) {
        request.log.warn({query: request.query}, 'cardcom-one-time-sale-wrong-secret')
        return reply.status(403).send({error: 'Forbidden'})
      }

      await dealWithControllerResultAsync(reply, () =>
        dealWithCardcomOneTimeSale(request.body, request.query['sales-event']),
      )

      return {}
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

  // View sale
  appWithTypes.get(
    '/:number',
    {schema: {params: z.object({number: z.coerce.number().int()})}},
    async (request, reply) => {
      return dealWithControllerResult(reply, await showSale(request.params.number, sql))
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
}
