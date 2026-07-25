import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import type {Sql} from 'postgres'
import * as z from 'zod'
import {replyWithControllerResult} from '../../commons/controller.ts'
import {calculateExpression, deleteHistory, showCalculatorPage} from './controller.ts'

export default function calculatorRoutes(app: FastifyInstance, {sql}: {sql: Sql}): void {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.get('/', async (_request, reply) =>
    replyWithControllerResult(reply, await showCalculatorPage(sql)),
  )

  appWithTypes.post(
    '/calculate',
    {schema: {body: z.object({expression: z.string()})}},
    async (request, reply) =>
      replyWithControllerResult(reply, await calculateExpression(sql, request.body.expression)),
  )

  appWithTypes.delete('/history', async (_request, reply) =>
    replyWithControllerResult(reply, await deleteHistory(sql)),
  )
}
