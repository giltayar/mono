import {SESSION_DURATION_MS, type Auth} from '../../commons/auth.ts'

/**
 * A path on this site, and only on this site. A `next` that came from the request is never trusted
 * as-is, because redirecting to it would otherwise turn the login page into an open redirect.
 *
 * A single leading slash keeps it on this origin (`//evil.com` and `/\evil.com` are protocol
 * relative), and the character set is the one RFC 3986 allows in a path, query, and fragment, so
 * nothing can be smuggled into the `Location` header.
 */
const SAFE_RETURN_PATH_REGEX = /^\/(?![/\\])[A-Za-z0-9\-._~/?#[\]@!$&'()*+,;=%]*$/

export function safeReturnPath(next: string | undefined): string {
  return next !== undefined && SAFE_RETURN_PATH_REGEX.test(next) ? next : '/'
}

/**
 * Turns a freshly minted ID token into a session cookie value, or `undefined` when the token is not
 * one the identity provider recognizes.
 */
export async function createSessionCookieValue(
  auth: Auth,
  idToken: string,
): Promise<string | undefined> {
  try {
    return await auth.createSessionCookie(idToken, SESSION_DURATION_MS)
  } catch {
    return undefined
  }
}
