import process from 'node:process'
import type {FastifyReply, FastifyRequest} from 'fastify'
import {requestContext} from '@fastify/request-context'
import type {AuthenticatedUser, FirebaseAuth, Session} from '../services/firebase-auth.ts'
import type {Language} from './i18n.ts'

declare module '@fastify/request-context' {
  interface RequestContextData {
    user: AuthenticatedUser | undefined
  }
}

export const SESSION_COOKIE_NAME = 'session'
export const LOGIN_PATH = '/login'

/** The user of the request being handled, or `undefined` when nobody is logged in */
export function currentUser(): AuthenticatedUser | undefined {
  return requestContext.get('user')
}

/**
 * The user of the request being handled, on a route that is behind `requireAuthentication`. Throws
 * rather than returning `undefined`, so that a route that is accidentally left unprotected fails
 * loudly instead of quietly reading somebody else's data.
 */
export function authenticatedUser(): AuthenticatedUser {
  const user = currentUser()

  if (user === undefined) {
    throw new Error('no authenticated user in a request that requires one')
  }

  return user
}

/**
 * Identifies the user of every request from its session cookie, and lets what that user has chosen
 * override what the request itself asked for. Must be registered inside the context of
 * `@fastify/cookie` and `@fastify/request-context`, whose own `onRequest` hooks it depends on.
 *
 * `loadUserSettings` is a parameter, and not an import, so that this file — which every layer may
 * use — does not depend on a domain. `src/app/monnaie-app.ts` is the one place that knows both.
 */
export function resolveUser(
  auth: FirebaseAuth,
  loadUserSettings: (userId: string) => Promise<{language?: Language}>,
): (request: FastifyRequest) => Promise<void> {
  return async (request) => {
    const cookie = request.cookies[SESSION_COOKIE_NAME]
    const user = cookie === undefined ? undefined : await auth.verifySession(cookie)

    requestContext.set('user', user)

    if (user === undefined) {
      // no user, no settings to read: an anonymous request costs no query
      return
    }

    const {language} = await loadUserSettings(user.uid)

    // the language the user picked is an account preference, so it follows them to a browser that
    // has never seen the `lang` cookie. `defaultStoreValues` already put the cookie's language
    // there, and this overrides it.
    if (language !== undefined) {
      requestContext.set('language', language)
    }
  }
}

/** Turns away anyone who is not logged in. Registered on the context that holds the private routes */
export async function requireAuthentication(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  if (currentUser() !== undefined) {
    return undefined
  }

  // HTMX follows a redirect inside the request it made, which would swap a whole login page into a
  // fragment, so it is told to navigate the browser instead
  if (request.headers['hx-request'] === 'true') {
    return reply.code(401).header('HX-Redirect', LOGIN_PATH).send()
  }

  return reply.code(303).header('Location', LOGIN_PATH).send()
}

export function sessionCookie({cookie, maxAgeInSeconds}: Session): string {
  return `${SESSION_COOKIE_NAME}=${cookie}; Path=/; Max-Age=${maxAgeInSeconds}; ${cookieAttributes()}`
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; ${cookieAttributes()}`
}

function cookieAttributes(): string {
  // `SameSite=Lax` is what keeps another site from POSTing to us with the user's session attached:
  // it is the CSRF defence of every form in this app. `HttpOnly` keeps the session out of reach of
  // scripts, which is why the login page hands the ID token to the server instead of storing it.
  const attributes = 'SameSite=Lax; HttpOnly'

  // the app is served over https everywhere except local development
  return process.env.NODE_ENV === 'production' ? `${attributes}; Secure` : attributes
}
