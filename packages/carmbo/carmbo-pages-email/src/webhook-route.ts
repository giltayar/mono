import type {FastifyInstance, FastifyRequest} from 'fastify'
import type {Sql} from 'postgres'
import {Webhook} from 'standardwebhooks'
import {z} from 'zod'
import {applyResendEvent, parseResendEvent} from './webhook.ts'

function header(request: FastifyRequest, name: string): string {
  const value = request.headers[name]
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export function webhookRoutes(
  app: FastifyInstance,
  {sql, signingSecret}: {sql: Sql; signingSecret: string},
): void {
  if (!signingSecret?.trim()) throw new Error('Resend webhook signing secret is required')
  const webhook = new Webhook(signingSecret)

  // Signatures cover the exact raw body, so this encapsulated plugin keeps JSON unparsed.
  app.removeContentTypeParser('application/json')
  app.addContentTypeParser('application/json', {parseAs: 'string'}, (_request, body, done) =>
    done(null, body),
  )

  app.post('/webhook', async (request, reply) => {
    let payload: unknown
    try {
      payload = webhook.verify(typeof request.body === 'string' ? request.body : '', {
        'webhook-id': header(request, 'svix-id'),
        'webhook-timestamp': header(request, 'svix-timestamp'),
        'webhook-signature': header(request, 'svix-signature'),
      })
    } catch (err) {
      request.log.warn({error: (err as Error).message}, 'resend-webhook-rejected-signature')
      return reply.status(400).send({error: 'Invalid webhook signature'})
    }

    let event: ReturnType<typeof parseResendEvent>
    try {
      event = parseResendEvent(payload)
    } catch (err) {
      if (!(err instanceof z.ZodError)) throw err
      request.log.warn({err}, 'resend-webhook-rejected-payload')
      return reply.status(400).send({error: 'Invalid webhook payload'})
    }

    if ('unsupported' in event) {
      request.log.info({type: event.unsupported}, 'resend-webhook-ignored-unsupported-event')
      return {outcome: 'unsupported'}
    }

    const {outcome, emailNumber} = await applyResendEvent(event, sql)
    request.log.info(
      {type: event.type, providerEmailId: event.providerEmailId, emailNumber, outcome},
      'resend-webhook-processed',
    )
    return {outcome}
  })
}
