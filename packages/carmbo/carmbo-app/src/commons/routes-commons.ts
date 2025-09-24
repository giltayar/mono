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
  } else {
    return reply
      .status(result.status ?? 200)
      .type('text/html')
      .send(result.body)
  }
}
