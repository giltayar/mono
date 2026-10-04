import type {FastifyInstance} from 'fastify'
import '@fastify/cookie'
import {dealWithControllerResult} from '@giltayar/carmbo-common/commons/routes-commons'
import {login, logout} from './controller.ts'
import {registerAuthLocaleResources} from './locale-resources.ts'
import {initializeFirebase, verifySessionCookie} from './model-firebase.ts'
import {LoginPage} from './view-login.ts'

interface FirebaseOptions {
  apiKey: string
  serviceAccountJson: string
}

export function routes(app: FastifyInstance, {firebase}: {firebase: FirebaseOptions}): void {
  initializeFirebase(firebase.serviceAccountJson)
  registerAuthLocaleResources()

  app.get('/login', async (_, reply) => {
    reply.type('text/html')
    return LoginPage({})
  })

  app.post('/login', async (request, reply) => {
    const {email, password} = request.body as {email: string; password: string}

    const {result, sessionCookie} = await login(email, password, firebase.apiKey)

    if (sessionCookie) {
      reply.setCookie('__session', sessionCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 14 * 24 * 60 * 60,
      })
    }

    return dealWithControllerResult(reply, result)
  })

  app.get('/logout', async (request, reply) => {
    const sessionCookie = request.cookies['__session']

    const result = await logout(sessionCookie)

    reply.clearCookie('__session', {path: '/'})

    if (typeof result === 'object' && 'htmxRedirect' in result) {
      return reply.redirect(result.htmxRedirect)
    } else {
      dealWithControllerResult(reply, result)
    }
  })
}

export function useFirebaseAuth(app: FastifyInstance): void {
  app.addHook('preHandler', async function hasSessionPreHandler(request, reply) {
    const sessionCookie = request.cookies['__session']

    if (!sessionCookie) {
      return reply.redirect('/auth/login')
    }

    const user = await verifySessionCookie(sessionCookie)
    if (!user) {
      return reply.redirect('/auth/login')
    }
  })
}
