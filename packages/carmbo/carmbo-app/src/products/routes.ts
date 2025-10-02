import {
  showProductCreate,
  showProductInHistory,
  showProducts,
  showProductUpdate,
  createProduct,
  updateProduct,
  showOngoingProduct,
  deleteProduct,
} from './controller.ts'
import {NewProductSchema, ProductSchema} from './model.ts'
import assert from 'node:assert'
import type {FastifyInstance} from 'fastify'
import type {Sql} from 'postgres'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import z from 'zod'
import {dealWithControllerResult} from '../commons/routes-commons.ts'

export default function (app: FastifyInstance, {sql}: {sql: Sql}) {
  // List products
  app.withTypeProvider<ZodTypeProvider>().get(
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
        await showProducts(
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

  // Create new product
  app.get('/new', async (_request, reply) =>
    dealWithControllerResult(reply, await showProductCreate()),
  )

  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/new', {schema: {body: NewProductSchema}}, async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showOngoingProduct(request.body, {addItem: request.headers['x-add-item']}),
      ),
    )

  app
    .withTypeProvider<ZodTypeProvider>()
    .post('/', {schema: {body: NewProductSchema}}, async (request, reply) => {
      return dealWithControllerResult(reply, await createProduct(request.body, sql))
    })

  // Edit existing product
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/:number',
      {schema: {params: z.object({number: z.coerce.number().int()})}},
      async (request, reply) => {
        return dealWithControllerResult(
          reply,
          await showProductUpdate(
            request.params.number,
            {addItem: request.headers['x-add-item']},
            sql,
          ),
        )
      },
    )

  app
    .withTypeProvider<ZodTypeProvider>()
    .post(
      '/:number',
      {schema: {body: ProductSchema, params: z.object({number: z.coerce.number().int()})}},
      async (request, reply) => {
        const productNumber = request.params.number

        assert(
          productNumber === request.body.productNumber,
          'product number in URL must match ID in body',
        )

        return dealWithControllerResult(
          reply,
          await showOngoingProduct(request.body, {addItem: request.headers['x-add-item']}),
        )
      },
    )

  app
    .withTypeProvider<ZodTypeProvider>()
    .put(
      '/:number',
      {schema: {body: ProductSchema, params: z.object({number: z.coerce.number().int()})}},
      async (request, reply) => {
        const productNumber = request.params.number

        assert(
          productNumber === request.body.productNumber,
          'product number in URL must match ID in body',
        )

        return dealWithControllerResult(reply, await updateProduct(request.body, sql))
      },
    )

  // View product in history
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:number/by-history/:operationId',
    {
      schema: {
        params: z.object({number: z.coerce.number().int(), operationId: z.uuid()}),
      },
    },
    async (request, reply) => {
      return dealWithControllerResult(
        reply,
        await showProductInHistory(request.params.number, request.params.operationId, sql),
      )
    },
  )

  // Delete (Archive) product
  app.withTypeProvider<ZodTypeProvider>().delete(
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
        await deleteProduct(request.params.number, request.query['delete-operation'], sql),
      ),
  )
}
