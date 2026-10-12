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
import packageJson from '../package.json' with {type: 'json'}
import {routes} from '../src/route.ts'

export async function createApp(database: Sql): Promise<FastifyInstance> {
  const language = process.env.LANGUAGE === 'he' ? 'he' : 'en'

  await initializei18next(language)
  setVersion(packageJson.version)
  setUiConfiguration(language === 'he' ? 'liraz' : 'carmel', {withCommunities: true})

  const app = fastify({logger: true})
  app.register(formbody)
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
    prefix: '/communities',
    sql: database,
    nowService: () => new Date(),
  })
  app.get('/', async (_request, reply) => reply.redirect('/communities'))

  return app
}
