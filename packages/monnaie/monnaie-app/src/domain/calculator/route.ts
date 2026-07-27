import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import * as z from 'zod'
import type {Db} from '../../commons/db.ts'
import {authenticatedUser} from '../../commons/auth.ts'
import {replyWithControllerResult} from '../../commons/controller.ts'
import {calculateExpression, deleteHistory, showCalculatorPage} from './controller.ts'

export default function calculatorRoutes(app: FastifyInstance, {db}: {db: Db}): void {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.get('/', async (_request, reply) =>
    replyWithControllerResult(reply, await showCalculatorPage(db, authenticatedUser().uid)),
  )

  appWithTypes.post(
    '/calculate',
    {schema: {body: z.object({expression: z.string()})}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await calculateExpression(db, authenticatedUser().uid, request.body.expression),
      ),
  )

  appWithTypes.delete('/history', async (_request, reply) =>
    replyWithControllerResult(reply, await deleteHistory(db, authenticatedUser().uid)),
  )
}
