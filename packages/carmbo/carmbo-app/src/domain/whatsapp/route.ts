import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import {z} from 'zod'
import {dealWithControllerResult} from '../../commons/routes-commons.ts'
import {showWhatsappGroupDatalist} from './controller.ts'

export default function (app: FastifyInstance) {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.get(
    '/query/datalist',
    {schema: {querystring: z.object({q: z.string().optional()})}},
    async (request, reply) =>
      dealWithControllerResult(reply, await showWhatsappGroupDatalist(request.query.q)),
  )
}
