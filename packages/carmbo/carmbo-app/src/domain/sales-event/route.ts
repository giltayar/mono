import {
  showSalesEventCreate,
  showSalesEventInHistory,
  showSalesEvents,
  showSalesEventUpdate,
  createSalesEvent,
  updateSalesEvent,
  showOngoingSalesEvent,
  deleteSalesEvent,
} from './controller.ts'
import {NewSalesEventSchema, SalesEventSchema} from './model.ts'
import {OngoingSalesEventSchema} from './view/model.ts'
import assert from 'node:assert'
import type {FastifyInstance} from 'fastify'
import type {Sql} from 'postgres'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import z from 'zod'
import {dealWithControllerResult} from '../../commons/routes-commons.ts'

export default function (app: FastifyInstance, {sql}: {sql: Sql}) {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  // List sales events
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
        await showSalesEvents(
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

  // Create new sales event
  app.get('/new', async (_request, reply) =>
    dealWithControllerResult(reply, await showSalesEventCreate(sql)),
  )

  appWithTypes.post('/new', {schema: {body: OngoingSalesEventSchema}}, async (request, reply) =>
    dealWithControllerResult(
      reply,
      await showOngoingSalesEvent(request.body, {addItem: request.headers['x-add-item']}, sql),
    ),
  )

  appWithTypes.post('/', {schema: {body: NewSalesEventSchema}}, async (request, reply) => {
    return dealWithControllerResult(reply, await createSalesEvent(request.body, sql))
  })

  // Edit existing sales event
  appWithTypes.get(
    '/:number',
    {schema: {params: z.object({number: z.coerce.number().int()})}},
    async (request, reply) => {
      return dealWithControllerResult(
        reply,
        await showSalesEventUpdate(
          request.params.number,
          {addItem: request.headers['x-add-item']},
          sql,
        ),
      )
    },
  )

  appWithTypes.post(
    '/:number',
    {
      schema: {
        body: OngoingSalesEventSchema,
        params: z.object({number: z.coerce.number().int()}),
      },
    },
    async (request, reply) => {
      return dealWithControllerResult(
        reply,
        await showOngoingSalesEvent(request.body, {addItem: request.headers['x-add-item']}, sql),
      )
    },
  )

  appWithTypes.put(
    '/:number',
    {schema: {body: SalesEventSchema, params: z.object({number: z.coerce.number().int()})}},
    async (request, reply) => {
      const salesEventNumber = request.params.number

      assert(
        salesEventNumber === request.body.salesEventNumber,
        'sales event number in URL must match ID in body',
      )

      return dealWithControllerResult(reply, await updateSalesEvent(request.body, sql))
    },
  )

  // View sales event in history
  appWithTypes.get(
    '/:number/by-history/:operationId',
    {
      schema: {
        params: z.object({number: z.coerce.number().int(), operationId: z.uuid()}),
      },
    },
    async (request, reply) => {
      return dealWithControllerResult(
        reply,
        await showSalesEventInHistory(request.params.number, request.params.operationId, sql),
      )
    },
  )

  // Delete (Archive) sales event
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
        await deleteSalesEvent(request.params.number, request.query['delete-operation'], sql),
      ),
  )
}
