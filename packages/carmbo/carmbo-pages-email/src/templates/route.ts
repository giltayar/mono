import type {FastifyInstance, FastifyRequest} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import {z} from 'zod'
import {dealWithControllerResult} from '@giltayar/carmbo-commons/commons/routes-commons'
import {
  createTemplate,
  deleteTemplate,
  sendTemplatePreview,
  showPreview,
  showRawHtml,
  showSamples,
  showSendDialog,
  showStoredRawHtml,
  showTemplateCreate,
  showTemplates,
  showTemplateUpdate,
  updateTemplate,
  type TemplateServices,
} from './controller.ts'
import {SendPreviewFormInputSchema, TemplateFormInputSchema} from './schema.ts'
import {assetVersion, readEditorAsset, templateListStyles} from './assets.ts'
import {RECIPIENT_COOKIE} from './view/dialogs.ts'
import {labels} from './view/labels.ts'

export function templateRoutes(app: FastifyInstance, services: TemplateServices): void {
  const {sql} = services
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
    return reply
      .status(invalid ? 400 : 500)
      .type('text/plain; charset=utf-8')
      .send(invalid ? labels().invalidTemplate : labels().unexpected)
  })
  const typed = app.withTypeProvider<ZodTypeProvider>()
  const params = z.object({number: z.coerce.number().int().positive()})
  const optionalParams = z.object({number: z.coerce.number().int().positive().optional()})
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
          sql,
        ),
      ),
  )
  typed.get('/new', async (_request, reply) =>
    dealWithControllerResult(reply, showTemplateCreate()),
  )
  typed.get('/:number', {schema: {params}}, async (request, reply) =>
    dealWithControllerResult(
      reply,
      await showTemplateUpdate(request.params.number, undefined, sql),
    ),
  )
  typed.get(
    '/:number/by-history/:historyId',
    {schema: {params: params.extend({historyId: z.uuid()})}},
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showTemplateUpdate(request.params.number, request.params.historyId, sql),
      ),
  )
  typed.get(
    '/:number/raw-html',
    {schema: {params, querystring: z.object({'history-id': z.uuid().optional()})}},
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showStoredRawHtml(request.params.number, request.query['history-id'], sql),
      ),
  )
  typed.post('/', {bodyLimit, schema: {body: TemplateFormInputSchema}}, async (request, reply) =>
    dealWithControllerResult(reply, await createTemplate(request.body, services, request.log)),
  )
  typed.put(
    '/:number',
    {bodyLimit, schema: {params, body: TemplateFormInputSchema}},
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await updateTemplate(request.params.number, request.body, services, request.log),
      ),
  )
  typed.delete(
    '/:number',
    {
      schema: {params, querystring: z.object({'delete-operation': z.enum(['delete', 'restore'])})},
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await deleteTemplate(
          request.params.number,
          request.query['delete-operation'],
          services,
          request.log,
        ),
      ),
  )
  typed.post(
    '/samples',
    {bodyLimit, schema: {body: TemplateFormInputSchema}},
    async (request, reply) => dealWithControllerResult(reply, showSamples(request.body)),
  )
  for (const prefix of ['/new', '/:number']) {
    typed.post(
      `${prefix}/raw-html`,
      {bodyLimit, schema: {params: optionalParams, body: TemplateFormInputSchema}},
      async (request, reply) =>
        dealWithControllerResult(reply, await showRawHtml(request.body, request.log)),
    )
    typed.post(
      `${prefix}/preview`,
      {bodyLimit, schema: {params: optionalParams, body: TemplateFormInputSchema}},
      async (request, reply) =>
        dealWithControllerResult(
          reply,
          await showPreview(request.params.number, request.body, sql, request.log),
        ),
    )
    typed.get(
      `${prefix}/send-preview`,
      {schema: {params: optionalParams}},
      async (request, reply) =>
        dealWithControllerResult(
          reply,
          showSendDialog(request.params.number, rememberedRecipient(request)),
        ),
    )
    typed.post(
      `${prefix}/send-preview`,
      {bodyLimit, schema: {params: optionalParams, body: SendPreviewFormInputSchema}},
      async (request, reply) => {
        const result = await sendTemplatePreview(
          request.params.number,
          request.body,
          services,
          request.log,
        )
        if ('dialog' in result) return reply.type('text/html').send(result.dialog)
        // The dialog closes itself on this event; the confirmation is an out-of-band banner.
        return reply
          .header('HX-Trigger', 'template-sent')
          .header('HX-Reswap', 'none')
          .type('text/html')
          .send(result.sent)
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

function rememberedRecipient(request: FastifyRequest): string {
  for (const cookie of (request.headers.cookie ?? '').split(';')) {
    const [name, ...value] = cookie.trim().split('=')
    if (name !== RECIPIENT_COOKIE) continue
    try {
      const recipient = decodeURIComponent(value.join('='))
      return recipient.length <= 320 ? recipient : ''
    } catch {
      return ''
    }
  }
  return ''
}
