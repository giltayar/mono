import type {FastifyInstance} from 'fastify'
import {LoginPage} from './view-login.ts'
import {login, logout} from './controller.ts'
import {dealWithControllerResult} from '../../commons/routes-commons.ts'
import {verifySessionCookie} from './model-firebase.ts'

export default function (app: FastifyInstance, {firebase}: {firebase: {apiKey: string}}) {
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

export function useFirebaseAuth(app: FastifyInstance) {
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
