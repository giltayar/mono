import type {FastifyReply} from 'fastify'

export type ControllerResult = {
  html: string
  /** Defaults to 200 */
  statusCode?: number
  /** Response headers, mostly used for HTMX headers such as `HX-Trigger` */
  headers?: Record<string, string>
}

export function replyWithControllerResult(
  reply: FastifyReply,
  {html, statusCode = 200, headers = {}}: ControllerResult,
): FastifyReply {
  return reply
    .code(statusCode)
    .header('Cache-Control', 'private, no-store')
    .headers(headers)
    .type('text/html')
    .send(html)
}
