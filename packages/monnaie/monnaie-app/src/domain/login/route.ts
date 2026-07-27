import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import * as z from 'zod'
import {replyWithControllerResult} from '../../commons/controller.ts'
import type {FirebaseAuth, PublicFirebaseConfig} from '../../services/firebase-auth.ts'
import {logIn, logInWithGoogle, logOut, showLoginPage} from './controller.ts'

export default function loginRoutes(
  app: FastifyInstance,
  {auth, firebaseConfig}: {auth: FirebaseAuth; firebaseConfig: PublicFirebaseConfig},
): void {
  const appWithTypes = app.withTypeProvider<ZodTypeProvider>()

  appWithTypes.get('/login', async (_request, reply) =>
    replyWithControllerResult(reply, await showLoginPage(firebaseConfig)),
  )

  appWithTypes.post(
    '/login',
    // deliberately loose: a badly-formed email is a failed login to be rendered on the login page,
    // not a fastify validation error handed to the user as JSON
    {schema: {body: z.object({email: z.string(), password: z.string()})}},
    async (request, reply) =>
      replyWithControllerResult(reply, await logIn(auth, firebaseConfig, request.body)),
  )

  appWithTypes.post(
    '/login/session',
    {schema: {body: z.object({idToken: z.string()})}},
    async (request, reply) =>
      replyWithControllerResult(reply, await logInWithGoogle(auth, request.body.idToken)),
  )

  appWithTypes.post('/logout', async (_request, reply) =>
    replyWithControllerResult(reply, await logOut()),
  )
}
