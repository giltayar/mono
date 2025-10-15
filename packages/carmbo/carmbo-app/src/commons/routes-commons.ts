import type {FastifyReply} from 'fastify'
import type {ControllerResult} from './controller-result.ts'

export function dealWithControllerResult<TReply extends FastifyReply>(
  reply: TReply,
  result: ControllerResult,
) {
  if (typeof result === 'string') {
    return reply.type('text/html').send(result)
  } else if ('htmxRedirect' in result) {
    return reply.header('HX-Redirect', result.htmxRedirect).send()
  } else if ('htmxTarget' in result) {
    return reply.header('HX-Retarget', result.htmxTarget).type('text/html').send(result.body)
  } else {
    return reply.status(result.status).type('text/html').send(result.body)
  }
}

export async function dealWithControllerResultAsync<TReply extends FastifyReply>(
  reply: TReply,
  resultFunc: () => Promise<ControllerResult>,
) {
  const result = await resultFunc().catch((err) => {
    if (err.httpStatus) {
      return {status: err.httpStatus, body: err.message}
    } else {
      return Promise.reject(err)
    }
  })

  if (typeof result === 'string') {
    return reply.type('text/html').send(result)
  } else if ('htmxRedirect' in result) {
    return reply.header('HX-Redirect', result.htmxRedirect).send()
  } else if ('htmxTarget' in result) {
    return reply.header('HX-Retarget', result.htmxTarget).type('text/html').send(result.body)
  } else {
    return reply.status(result.status).type('text/html').send(result.body)
  }
}
