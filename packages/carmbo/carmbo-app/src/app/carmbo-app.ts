import fastify from 'fastify'
import formbody from '@fastify/formbody'
import fastifystatic from '@fastify/static'
import qs from 'qs'
import postgres from 'postgres'
import studentRoutes from '../students/routes.ts'
import {serializerCompiler, validatorCompiler} from 'fastify-type-provider-zod'

export function makeApp({
  db: {host, port, username, password},
}: {
  db: {host: string; port: number; username: string; password: string}
}) {
  const app = fastify({logger: true})
  const sql = postgres({
    host,
    port,
    database: 'carmbo',
    username,
    password,
    transform: {...postgres.camel},
  })

  app.register(formbody, {parser: (str) => qs.parse(str)})
  app.register(fastifystatic, {root: new URL('../../dist', import.meta.url), prefix: '/public/'})
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.get('/', async (_, reply) => reply.redirect('/students'))

  app.register(studentRoutes, {prefix: '/students', sql})

  app.get('/health', async () => {
    return {status: 'ok'}
  })

  return app
}
