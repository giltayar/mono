import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import * as z from 'zod'
import type {Db} from '../../commons/db.ts'
import {replyWithControllerResult} from '../../commons/controller.ts'
import {requireAuthentication} from '../../commons/auth.ts'
import {calculateExpression, deleteHistory, showCalculatorPage} from './controller.ts'

export default function calculatorRoutes(app: FastifyInstance, {db}: {db: Db}): void {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  // scoped to this plugin, so it guards every route in it and nothing outside it
  app.addHook('preHandler', requireAuthentication)

  appWithTypes.get('/', async (_request, reply) =>
    replyWithControllerResult(reply, await showCalculatorPage(db)),
  )

  appWithTypes.post(
    '/calculate',
    {schema: {body: z.object({expression: z.string()})}},
    async (request, reply) =>
      replyWithControllerResult(reply, await calculateExpression(db, request.body.expression)),
  )

  appWithTypes.delete('/history', async (_request, reply) =>
    replyWithControllerResult(reply, await deleteHistory(db)),
  )
}
