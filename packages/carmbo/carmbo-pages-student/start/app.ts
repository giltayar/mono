import formbody from '@fastify/formbody'
import {fastifyRequestContext} from '@fastify/request-context'
import fastifyStatic from '@fastify/static'
import {initializei18next} from '@giltayar/carmbo-commons/commons/i18next-utils'
import {setUiConfiguration} from '@giltayar/carmbo-commons/commons/ui-configuration'
import {setVersion} from '@giltayar/carmbo-commons/commons/version'
import {layoutAssetRoutes} from '@giltayar/carmbo-commons/layout/assets'
import fastify, {type FastifyInstance} from 'fastify'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import type {Sql} from 'postgres'
import qs from 'qs'
import packageJson from '../package.json' with {type: 'json'}
import {routes} from '../src/route.ts'
import type {createFakes} from './fakes.ts'

export async function createApp(
  database: Sql,
  fakes: ReturnType<typeof createFakes>,
): Promise<FastifyInstance> {
  const language = process.env.LANGUAGE === 'he' ? 'he' : 'en'

  await initializei18next(language)
  setVersion(packageJson.version)
  setUiConfiguration(language === 'he' ? 'liraz' : 'carmel')

  const app = fastify({logger: true})
  app.register(formbody, {parser: (body) => qs.parse(body)})
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.register(fastifyRequestContext, {
    defaultStoreValues: () => ({TEST_hooks: undefined}),
  })
  app.register(layoutAssetRoutes)
  app.register(fastifyStatic, {
    root: new URL('./dist', import.meta.url),
    prefix: `/dist/${packageJson.version}/`,
    decorateReply: false,
    immutable: true,
    maxAge: '1y',
  })
  app.register(routes, {
    prefix: '/students',
    sql: database,
    academyIntegration: fakes.academyIntegration,
    academyAccountSubdomains: ['carmel'],
    smooveIntegration: fakes.smooveIntegration,
    ravmesserIntegration: fakes.ravmesserIntegration,
    nowService: () => new Date(),
  })
  app.get('/', async (_request, reply) => reply.redirect('/students'))

  return app
}
