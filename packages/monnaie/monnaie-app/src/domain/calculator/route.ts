import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import * as z from 'zod'
import {calculate} from './model.ts'
import {renderCalculationResult, renderCalculatorPage} from './view/view.ts'

export default function calculatorRoutes(app: FastifyInstance): void {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.get('/', async (_request, reply) =>
    reply.type('text/html').send(renderCalculatorPage()),
  )

  appWithTypes.post(
    '/calculate',
    {schema: {body: z.object({expression: z.string()})}},
    async (request, reply) =>
      reply.type('text/html').send(renderCalculationResult(calculate(request.body.expression))),
  )
}
