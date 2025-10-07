import type {FastifyInstance} from 'fastify'
import {z} from 'zod'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import {CardcomSaleWebhookJsonSchema} from './model.ts'
import {dealWithCardcomOneTimeSale} from './controller.ts'

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

      await dealWithCardcomOneTimeSale(request.body, request.query['sales-event'])

      return {}
    },
  )
}
