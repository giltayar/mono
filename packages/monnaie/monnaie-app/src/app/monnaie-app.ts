import fastify, {type FastifyInstance} from 'fastify'
import formbody from '@fastify/formbody'
import fastifyStatic from '@fastify/static'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'
import calculatorRoutes from '../domain/calculator/route.ts'
import {version} from '../commons/version.ts'

export function makeApp(): FastifyInstance {
  const app = fastify({
    logger:
      process.env.NODE_ENV !== 'test'
        ? {
            level: 'info',
            formatters: {
              level(label, _number) {
                return {level: label}
              },
            },
          }
        : false,
  })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.register(formbody)

  app.register(fastifyStatic, {
    root: new URL('../../dist', import.meta.url),
    prefix: `/dist/${version}/`,
    decorateReply: false,
    immutable: true,
    maxAge: '1y',
  })
  app.register(fastifyStatic, {
    root: new URL('../../src', import.meta.url),
    prefix: `/src/${version}/`,
    decorateReply: false,
    immutable: true,
    maxAge: '1y',
    allowedPath: (pathName) => pathName.endsWith('.css') || pathName.endsWith('.js'),
  })

  app.register(calculatorRoutes)

  app.get('/health', async () => ({status: 'ok', version}))

  return app
}
