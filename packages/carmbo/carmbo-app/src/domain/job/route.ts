import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import z from 'zod'
import {triggerJobsExecution} from './job-executor.ts'
import {dealWithControllerResult} from '../../commons/routes-commons.ts'
import {showJob, showJobs} from './controller.ts'
import type {Sql} from 'postgres'

export default function (app: FastifyInstance, {sql}: {sql: Sql}) {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.get(
    '/',
    {
      schema: {
        querystring: z
          .object({
            page: z.coerce.number().int().min(0).default(0).optional(),
            'with-trivial': z.string(),
          })
          .partial(),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showJobs(sql, {
          page: request.query.page ?? 0,
          withTrivial: 'with-trivial' in request.query,
        }),
      ),
  )
  appWithTypes.get(
    '/:jobId',
    {schema: {params: z.object({jobId: z.coerce.number().int()})}},
    async (request, reply) =>
      dealWithControllerResult(reply, await showJob(request.params.jobId, sql)),
  )
}

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
      const nowService = request.requestContext.get('nowService')!

      request.log.info('execute-jobs-api-called')

      triggerJobsExecution(nowService)

      return {message: 'triggered'}
    },
  )
}
