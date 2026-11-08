import type {FastifyInstance} from 'fastify'
import type {Sql} from 'postgres'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import {z} from 'zod'
import {dealWithControllerResult} from '@giltayar/carmbo-commons/commons/routes-commons'
import {registerEmailLocaleResources} from './locale-resources.ts'
import {showEmail, showEmails, showEmailSource} from './controller.ts'

export function routes(app: FastifyInstance, {sql}: {sql: Sql}): void {
  registerEmailLocaleResources()
  const typed = app.withTypeProvider<ZodTypeProvider>()
  const params = z.object({number: z.coerce.number().int().positive()})

  typed.get(
    '/',
    {
      schema: {
        querystring: z.object({
          q: z.string().default(''),
          page: z.coerce.number().int().nonnegative().default(0),
        }),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showEmails({query: request.query.q, page: request.query.page}, sql),
      ),
  )
  typed.get('/:number', {schema: {params}}, async (request, reply) =>
    dealWithControllerResult(reply, await showEmail(request.params.number, sql)),
  )
  typed.get('/:number/html', {schema: {params}}, async (request, reply) => {
    const result = await showEmailSource(request.params.number, sql)
    return reply
      .status(result.status)
      .type('text/plain; charset=utf-8')
      .header('X-Content-Type-Options', 'nosniff')
      .header('Content-Security-Policy', "default-src 'none'; sandbox")
      .send(result.body)
  })
}
