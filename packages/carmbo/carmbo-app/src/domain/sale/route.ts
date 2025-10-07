import type {FastifyInstance} from 'fastify'

export function apiRoute(app: FastifyInstance, {secret}: {secret: string}) {
  app.post<{Querystring: {secret: string}}>('/cardcom/one-time-sale', async (request, reply) => {
    if (request.query.secret !== secret) {
      request.log.warn({query: request.query}, 'cardcom-one-time-sale-wrong-secret')
      return reply.status(403).send({error: 'Forbidden'})
    }
    request.log.info({body: request.body}, 'cardcom-one-time-sale')

    return {}
  })
}
