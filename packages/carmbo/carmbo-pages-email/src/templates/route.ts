import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import {z} from 'zod'
import {dealWithControllerResult} from '@giltayar/carmbo-commons/commons/routes-commons'
import {showTemplate, showTemplates, templateAction, type TemplateServices} from './controller.ts'
import {TemplateSchema} from './schema.ts'
import {assetVersion, readEditorAsset, templateListStyles} from './assets.ts'
import {labels} from './view.ts'

export function templateRoutes(app: FastifyInstance, services: TemplateServices): void {
  app.get('/style.css', async (_request, reply) =>
    reply.type('text/css; charset=utf-8').send(templateListStyles),
  )
  app.setErrorHandler((error, request, reply) => {
    const invalid =
      error instanceof Error &&
      ('validation' in error || ('statusCode' in error && error.statusCode === 400))
    request.log.error(
      {errorName: error instanceof Error ? error.name : 'unknown', invalid},
      'email-template-request-failed',
    )
    return reply.status(invalid ? 400 : 500).send({
      error: invalid ? labels().invalidTemplate : labels().unexpected,
    })
  })
  const typed = app.withTypeProvider<ZodTypeProvider>()
  const params = z.object({number: z.coerce.number().int().positive()})
  const bodyLimit = 4 * 1024 * 1024
  typed.get(
    '/',
    {
      schema: {
        querystring: z.object({
          q: z.string().max(1000).default(''),
          page: z.coerce.number().int().nonnegative().default(0),
          'with-archived': z.string().optional(),
        }),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showTemplates(
          {
            query: request.query.q,
            page: request.query.page,
            withArchived: request.query['with-archived'] !== undefined,
          },
          services.sql,
        ),
      ),
  )
  typed.get('/new', async (_request, reply) =>
    dealWithControllerResult(reply, await showTemplate(undefined, undefined, services.sql)),
  )
  typed.get('/:number', {schema: {params}}, async (request, reply) =>
    dealWithControllerResult(
      reply,
      await showTemplate(request.params.number, undefined, services.sql),
    ),
  )
  typed.get(
    '/:number/by-history/:historyId',
    {
      schema: {params: params.extend({historyId: z.uuid()})},
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showTemplate(request.params.number, request.params.historyId, services.sql),
      ),
  )
  typed.post('/', {bodyLimit, schema: {body: TemplateSchema}}, async (request, reply) => {
    const result = await templateAction(
      undefined,
      {type: 'save', template: request.body},
      services,
      request.log,
    )
    return reply.status(result.status).type('application/json').send(result.body)
  })
  typed.put(
    '/:number',
    {bodyLimit, schema: {params, body: TemplateSchema}},
    async (request, reply) => {
      const result = await templateAction(
        request.params.number,
        {type: 'save', template: request.body},
        services,
        request.log,
      )
      return reply.status(result.status).type('application/json').send(result.body)
    },
  )
  typed.delete(
    '/:number',
    {
      schema: {params, querystring: z.object({'delete-operation': z.enum(['delete', 'restore'])})},
    },
    async (request, reply) => {
      const result = await templateAction(
        request.params.number,
        {
          type: 'archive',
          operation: request.query['delete-operation'],
        },
        services,
        request.log,
      )
      return reply.status(result.status).type('application/json').send(result.body)
    },
  )
  for (const prefix of ['/new', '/:number']) {
    const previewParams = z.object({number: z.coerce.number().int().positive().optional()})
    typed.post(
      `${prefix}/preview`,
      {
        bodyLimit,
        schema: {params: previewParams, body: TemplateSchema},
      },
      async (request, reply) => {
        const result = await templateAction(
          request.params.number,
          {type: 'preview', template: request.body},
          services,
          request.log,
        )
        return reply.status(result.status).type('application/json').send(result.body)
      },
    )
    typed.post(
      `${prefix}/send-preview`,
      {
        bodyLimit,
        schema: {
          params: previewParams,
          body: z.object({
            template: TemplateSchema,
            to: z.email(),
            requestId: z.uuid(),
          }),
        },
      },
      async (request, reply) => {
        const result = await templateAction(
          request.params.number,
          {type: 'send', ...request.body},
          services,
          request.log,
        )
        return reply.status(result.status).type('application/json').send(result.body)
      },
    )
  }
  for (const name of ['editor.js', 'editor.css'] as const) {
    app.get(`/assets/${assetVersion}/${name}`, async (_request, reply) =>
      reply
        .type(name.endsWith('.js') ? 'application/javascript' : 'text/css')
        .header('Cache-Control', 'no-cache')
        .header('X-Content-Type-Options', 'nosniff')
        .send(await readEditorAsset(name)),
    )
  }
}
