import type {FastifyReply} from 'fastify'

export type ControllerResult = {
  html: string
  statusCode?: number
  /** Response headers, mostly used for HTMX headers such as `HX-Trigger` */
  headers?: Record<string, string>
}

export function replyWithControllerResult(
  reply: FastifyReply,
  {html, statusCode = 200, headers = {}}: ControllerResult,
): FastifyReply {
  return reply.code(statusCode).headers(headers).type('text/html').send(html)
}
