import type {FastifyInstance} from 'fastify'
import type {Sql} from 'postgres'
import type {NowService} from '@giltayar/carmbo-commons/commons/now-service'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import z from 'zod'
import {dealWithControllerResult} from '@giltayar/carmbo-commons/commons/routes-commons'
import {
  createCommunity,
  deleteCommunity,
  showCommunities,
  showCommunityCreate,
  showCommunityInHistory,
  showCommunityUpdate,
  updateCommunity,
} from './controller.ts'
import {CommunityViewSchema} from './view/model.ts'
import {registerCommunityLocaleResources} from './locale-resources.ts'
import {communityScripts, communityStyles} from './assets.ts'
type CommunityRouteOptions = {
  sql: Sql
  nowService: NowService
}

export function routes(app: FastifyInstance, {sql, nowService}: CommunityRouteOptions): void {
  registerCommunityLocaleResources()

  app.get('/style.css', async (_request, reply) =>
    reply.type('text/css; charset=utf-8').send(communityStyles),
  )
  app.get('/scripts.js', async (_request, reply) =>
    reply.type('application/javascript; charset=utf-8').send(communityScripts),
  )

  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()
  const numberParams = z.object({number: z.coerce.number().int()})

  // List communities
  appWithTypes.get(
    '/',
    {
      schema: {
        querystring: z
          .object({
            'with-archived': z.string(),
            q: z.string(),
            page: z.coerce.number().int().min(0).default(0).optional(),
          })
          .partial(),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showCommunities(
          {
            withArchived: 'with-archived' in request.query,
            query: request.query.q,
            page: request.query.page ?? 0,
          },
          sql,
        ),
      ),
  )

  // Create new community
  app.get('/new', async (_request, reply) =>
    dealWithControllerResult(reply, showCommunityCreate(undefined)),
  )

  appWithTypes.post('/', {schema: {body: CommunityViewSchema}}, async (request, reply) =>
    dealWithControllerResult(
      reply,
      await createCommunity(request.body, sql, {nowService, logger: request.log}),
    ),
  )

  // Edit existing community
  appWithTypes.get('/:number', {schema: {params: numberParams}}, async (request, reply) =>
    dealWithControllerResult(
      reply,
      await showCommunityUpdate(request.params.number, undefined, sql),
    ),
  )

  appWithTypes.put(
    '/:number',
    {schema: {body: CommunityViewSchema, params: numberParams}},
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await updateCommunity(request.params.number, request.body, sql, {
          nowService,
          logger: request.log,
        }),
      ),
  )

  // View community in history
  appWithTypes.get(
    '/:number/by-history/:operationId',
    {schema: {params: numberParams.extend({operationId: z.uuid()})}},
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await showCommunityInHistory(request.params.number, request.params.operationId, sql),
      ),
  )

  // Archive or restore community
  appWithTypes.delete(
    '/:number',
    {
      schema: {
        params: numberParams,
        querystring: z.object({'delete-operation': z.enum(['delete', 'restore'])}),
      },
    },
    async (request, reply) =>
      dealWithControllerResult(
        reply,
        await deleteCommunity(request.params.number, request.query['delete-operation'], sql, {
          nowService,
          logger: request.log,
        }),
      ),
  )
}
