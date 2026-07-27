import type {FastifyReply, FastifyRequest} from 'fastify'
import {requestContext} from '@fastify/request-context'

declare module '@fastify/request-context' {
  interface RequestContextData {
    user: AuthenticatedUser | undefined
  }
}

export type AuthenticatedUser = {uid: string; email: string | undefined}

/** The parts of the identity provider's configuration that are public and belong in the browser */
export type AuthClientConfig = {apiKey: string; authDomain: string; projectId: string}

/**
 * Everything the app needs from an identity provider. The app depends on this port and never on
 * firebase directly, so that the integration tests can inject a fake one.
 */
export type Auth = {
  clientConfig: AuthClientConfig
  /** Exchanges a freshly minted ID token for a long-lived session cookie value */
  createSessionCookie(idToken: string, expiresInMs: number): Promise<string>
  /** The user of a session cookie, or `undefined` when it is missing, expired, or forged */
  verifySessionCookie(sessionCookie: string): Promise<AuthenticatedUser | undefined>
}

export const SESSION_COOKIE_NAME = 'session'
export const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000

/** The user of the request being handled, or `undefined` when it is anonymous */
export function currentUser(): AuthenticatedUser | undefined {
  return requestContext.get('user')
}

/** The user of a request that went through `requireAuthentication`, and therefore always has one */
export function currentUserOrFail(): AuthenticatedUser {
  const user = currentUser()

  if (user === undefined) {
    throw new Error('this code must run behind `requireAuthentication`, but no user was found')
  }

  return user
}

export function sessionCookie(value: string, {secure}: {secure: boolean}): string {
  return serializeSessionCookie(value, {maxAgeInSeconds: SESSION_DURATION_MS / 1000, secure})
}

export function clearedSessionCookie({secure}: {secure: boolean}): string {
  return serializeSessionCookie('', {maxAgeInSeconds: 0, secure})
}

/**
 * Puts the user of the request in the request context, so that nothing has to thread it through the
 * layers.
 *
 * Deliberately a `preHandler` hook and not an `onRequest` one: it needs both `request.cookies` and
 * the request context, which are set up by the `onRequest` hooks of `@fastify/cookie` and
 * `@fastify/request-context`, and a hook added here would otherwise have to be ordered against
 * plugins that fastify only loads later.
 */
export function resolveUser(auth: Auth): (request: FastifyRequest) => Promise<void> {
  return async function resolveUserOfRequest(request) {
    const sessionCookieValue = request.cookies[SESSION_COOKIE_NAME]

    if (sessionCookieValue === undefined) {
      return
    }

    requestContext.set('user', await auth.verifySessionCookie(sessionCookieValue))
  }
}

/**
 * A `preHandler` hook that sends anonymous requests to the login page, remembering the page they
 * were on so that signing in returns them to it.
 */
export async function requireAuthentication(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | undefined> {
  if (currentUser() !== undefined) {
    return undefined
  }

  const loginUrl = `/login?next=${encodeURIComponent(request.url)}`

  // htmx would follow a redirect inside the XHR and swap the whole login page into a fragment, so
  // ask the browser to navigate instead
  return request.headers['hx-request'] === 'true'
    ? reply.code(204).header('HX-Redirect', loginUrl).send()
    : reply.code(303).header('Location', loginUrl).send()
}

function serializeSessionCookie(
  value: string,
  {maxAgeInSeconds, secure}: {maxAgeInSeconds: number; secure: boolean},
) {
  return (
    `${SESSION_COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAgeInSeconds}; SameSite=Lax; HttpOnly` +
    (secure ? '; Secure' : '')
  )
}
