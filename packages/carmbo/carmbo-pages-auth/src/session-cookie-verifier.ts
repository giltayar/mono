import {LRUCache} from 'lru-cache'

interface SessionCookieAuth {
  verifySessionCookie(
    sessionCookie: string,
    checkRevoked?: boolean,
  ): Promise<{uid: string; email?: string}>
}

export interface SessionCookieVerifier {
  verify(sessionCookie: string): Promise<{uid: string; email?: string} | undefined>
  invalidate(uid: string): void
}

const REVOCATION_CHECK_TTL = 5 * 60 * 1000
const REVOCATION_CHECK_CACHE_MAX = 10_000

export function createSessionCookieVerifier(
  auth: SessionCookieAuth,
  {ttl = REVOCATION_CHECK_TTL, max = REVOCATION_CHECK_CACHE_MAX}: {ttl?: number; max?: number} = {},
): SessionCookieVerifier {
  const revocationChecks = new LRUCache<string, Promise<void>>({ttl, max})

  return {
    async verify(sessionCookie) {
      try {
        const decoded = await auth.verifySessionCookie(sessionCookie, false)
        let revocationCheck = revocationChecks.get(decoded.uid)

        if (!revocationCheck) {
          revocationCheck = auth
            .verifySessionCookie(sessionCookie, true)
            .then(() => undefined)
            .catch((error: unknown) => {
              revocationChecks.delete(decoded.uid)
              throw error
            })
          revocationChecks.set(decoded.uid, revocationCheck)
        }

        await revocationCheck
        return {uid: decoded.uid, email: decoded.email}
      } catch {
        return undefined
      }
    },
    invalidate(uid) {
      revocationChecks.delete(uid)
    },
  }
}
