import type {FastifyInstance} from 'fastify'
import type {ZodTypeProvider} from 'fastify-type-provider-zod'
import * as z from 'zod'
import {replyWithControllerResult} from '../../commons/controller.ts'
import type {Db} from '../../commons/db.ts'
import type {FirebaseAuth, PublicFirebaseConfig} from '../../services/firebase-auth.ts'
import {
  logIn,
  logInWithGoogle,
  logOut,
  register,
  showLoginPage,
  showRegistrationPage,
} from './controller.ts'

export default function loginRoutes(
  app: FastifyInstance,
  {auth, firebaseConfig, db}: {auth: FirebaseAuth; firebaseConfig: PublicFirebaseConfig; db: Db},
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
      replyWithControllerResult(reply, await logIn(auth, db, firebaseConfig, request.body)),
  )

  appWithTypes.post(
    '/login/session',
    {schema: {body: z.object({idToken: z.string()})}},
    async (request, reply) =>
      replyWithControllerResult(reply, await logInWithGoogle(auth, db, request.body.idToken)),
  )

  appWithTypes.get('/register', async (_request, reply) =>
    replyWithControllerResult(reply, await showRegistrationPage()),
  )

  appWithTypes.post(
    '/register',
    // loose for the same reason as `/login`: every complaint about what was typed belongs on the
    // registration page, in the user's language, and not in a fastify error
    {
      schema: {
        body: z.object({email: z.string(), password: z.string(), confirmPassword: z.string()}),
      },
    },
    async (request, reply) =>
      replyWithControllerResult(reply, await register(auth, db, request.body)),
  )

  appWithTypes.post('/logout', async (_request, reply) =>
    replyWithControllerResult(reply, await logOut()),
  )
}
