import {
  showSalesEventCreate,
  showSalesEventInHistory,
  showSalesEvents,
  showSalesEventUpdate,
  createSalesEvent,
  updateSalesEvent,
  showOngoingSalesEvent,
  deleteSalesEvent,
  showImportSmooveDialog,
  executeImportFromSmooveList,
} from './controller.ts'
import {NewSalesEventSchema, SalesEventSchema} from './model/model.ts'
import {OngoingSalesEventSchema} from './view/model.ts'
import type {FastifyInstance} from 'fastify'
import type {Sql} from 'postgres'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import z from 'zod'
import {dealWithControllerResult} from '../../commons/routes-commons.ts'

export default function (
  app: FastifyInstance,
  {sql, appBaseUrl, apiSecret}: {sql: Sql; appBaseUrl: string; apiSecret: string | undefined},
) {
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
    dealWithControllerResult(reply, await showSalesEventCreate(undefined, {}, sql)),
  )

  appWithTypes.post('/new', {schema: {body: OngoingSalesEventSchema}}, async (request, reply) =>
    dealWithControllerResult(
      reply,
      await showOngoingSalesEvent(
        request.body,
        {manipulations: {addItem: request.headers['x-add-item']}},
        sql,
      ),
    ),
  )

  appWithTypes.post('/', {schema: {body: NewSalesEventSchema}}, async (request, reply) => {
    return dealWithControllerResult(reply, await createSalesEvent(request.body, sql))
  })

  // Edit existing sales event
  appWithTypes.get(
    '/:number',
    {
      schema: {
        params: z.object({number: z.coerce.number()}),
        querystring: z.object({add: z.enum(['item']).optional()}),
      },
    },
    async (request, reply) => {
      const salesEventNumber = request.params.number

      return dealWithControllerResult(
        reply,
        await showSalesEventUpdate(salesEventNumber, undefined, sql, {
          appBaseUrl,
          apiSecret,
        }),
      )
    },
  )

  appWithTypes.post(
    '/:number',
    {
      schema: {
        params: z.object({number: z.coerce.number()}),
        body: OngoingSalesEventSchema,
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showOngoingSalesEvent(
          request.body,
          {manipulations: {addItem: request.headers['x-add-item']}},
          sql,
        ),
      ),
  )

  appWithTypes.put(
    '/:number',
    {
      schema: {
        params: z.object({number: z.coerce.number()}),
        body: SalesEventSchema,
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await updateSalesEvent(request.body, sql, {appBaseUrl, apiSecret}),
      ),
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
        params: z.object({number: z.coerce.number()}),
        querystring: z.object({'delete-operation': z.enum(['delete', 'restore'])}),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await deleteSalesEvent(request.params.number, request.query['delete-operation'], sql, {
          appBaseUrl,
          apiSecret,
        }),
      ),
  )

  // Import from Smoove
  appWithTypes.get(
    '/:number/import-smoove-dialog',
    {
      schema: {
        params: z.object({number: z.coerce.number()}),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(reply, await showImportSmooveDialog(request.params.number)),
  )

  // Import from Smoove
  appWithTypes.post(
    '/:number/import-smoove',
    {
      schema: {
        params: z.object({number: z.coerce.number()}),
        body: z.object({smooveListId: z.coerce.number()}),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await executeImportFromSmooveList(request.params.number, request.body.smooveListId, sql),
      ),
  )
}
