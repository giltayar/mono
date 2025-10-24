import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import z from 'zod'
import {triggerJobsExecution} from './job-executor.ts'

export function apiRoute(app: FastifyInstance, {secret}: {secret: string | undefined}) {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.post(
    '/trigger-job-execution',
    {schema: {querystring: z.object({secret: z.string()})}},
    async (request, reply) => {
      if (secret && request.query.secret !== secret) {
        request.log.warn({query: request.query}, 'wrong-api-secret')
        return reply.status(403).send({error: 'Forbidden'})
      }

      request.log.info('execute-jobs-api-called')

      triggerJobsExecution()

      return {message: 'triggered'}
    },
  )
}
