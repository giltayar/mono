import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import * as z from 'zod'
import type {Auth} from '../../commons/auth.ts'
import {replyWithControllerResult} from '../../commons/controller.ts'
import {createSession, logout, showLoginPage} from './controller.ts'

export default function authenticationRoutes(
  app: FastifyInstance,
  {auth, secureCookies}: {auth: Auth; secureCookies: boolean},
): void {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.get(
    '/login',
    {schema: {querystring: z.object({next: z.string().optional()})}},
    async (request, reply) =>
      replyWithControllerResult(reply, await showLoginPage(auth, request.query.next)),
  )

  appWithTypes.post(
    '/session',
    {schema: {body: z.object({idToken: z.string()})}},
    async (request, reply) =>
      replyWithControllerResult(
        reply,
        await createSession(auth, {idToken: request.body.idToken, secureCookies}),
      ),
  )

  appWithTypes.post('/logout', async (_request, reply) =>
    replyWithControllerResult(reply, await logout({secureCookies})),
  )
}
