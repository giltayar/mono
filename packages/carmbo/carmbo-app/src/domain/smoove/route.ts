import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import {z} from 'zod'
import {dealWithControllerResult} from '../../commons/routes-commons.ts'
import {showSmooveListDatalist, showSmooveListCreateDialog, createSmooveList} from './controller.ts'

export default function (app: FastifyInstance) {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.get(
    '/query/datalist',
    {schema: {querystring: z.object({q: z.string().optional()})}},
    async (request, reply) =>
      dealWithControllerResult(reply, await showSmooveListDatalist(request.query.q)),
  )

  appWithTypes.get(
    '/list-create-dialog',
    {
      schema: {
        querystring: z.object({
          targetFieldId: z.enum(['smooveListId', 'smooveCancelledListId', 'smooveRemovedListId']),
        }),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showSmooveListCreateDialog(request.query.targetFieldId),
      ),
  )

  appWithTypes.post(
    '/create-list',
    {
      schema: {
        body: z.object({
          listName: z.string().min(1),
          targetFieldId: z.string(),
        }),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(reply, await createSmooveList(request.body.listName)),
  )
}
