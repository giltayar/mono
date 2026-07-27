import {clearedSessionCookie, sessionCookie, type Auth} from '../../commons/auth.ts'
import type {ControllerResult} from '../../commons/controller.ts'
import {createSessionCookieValue, safeReturnPath} from './model.ts'
import {renderLoginPage} from './view/view.ts'

export async function showLoginPage(
  auth: Auth,
  next: string | undefined,
): Promise<ControllerResult> {
  return {html: renderLoginPage({clientConfig: auth.clientConfig, next: safeReturnPath(next)})}
}

/**
 * Trades the ID token the browser got from the identity provider for a session cookie. The browser
 * navigates on its own afterwards, so there is no body to render and no redirect to follow.
 */
export async function createSession(
  auth: Auth,
  {idToken, secureCookies}: {idToken: string; secureCookies: boolean},
): Promise<ControllerResult> {
  const value = await createSessionCookieValue(auth, idToken)

  if (value === undefined) {
    return {html: '', statusCode: 401}
  }

  return {
    html: '',
    statusCode: 204,
    headers: {'Set-Cookie': sessionCookie(value, {secure: secureCookies})},
  }
}

export async function logout({
  secureCookies,
}: {
  secureCookies: boolean
}): Promise<ControllerResult> {
  return {
    html: '',
    statusCode: 303,
    headers: {
      // deliberately a fixed path, and never anything taken from the request, so that this cannot
      // be turned into an open redirect
      Location: '/login',
      'Set-Cookie': clearedSessionCookie({secure: secureCookies}),
    },
  }
}
