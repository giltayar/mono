import type {Auth} from '../../../src/commons/auth.ts'

const ID_TOKEN_PREFIX = 'fake-id-token:'
const SESSION_PREFIX = 'fake-session:'

/** An ID token this fake, and only this fake, recognizes */
export function fakeIdToken(email: string): string {
  return `${ID_TOKEN_PREFIX}${email}`
}

/**
 * Stands in for firebase in the integration tests. The client-side half of signing in is the only
 * thing it cannot fake, which is why the e2e test signs in against the real identity provider.
 */
export function createFakeAuth(): Auth {
  return {
    clientConfig: {
      apiKey: 'fake-api-key',
      authDomain: 'fake.firebaseapp.com',
      projectId: 'fake-project',
    },

    async createSessionCookie(idToken) {
      if (!idToken.startsWith(ID_TOKEN_PREFIX)) {
        throw new Error('not an ID token this fake ever minted')
      }

      return SESSION_PREFIX + idToken.slice(ID_TOKEN_PREFIX.length)
    },

    async verifySessionCookie(sessionCookie) {
      if (!sessionCookie.startsWith(SESSION_PREFIX)) {
        return undefined
      }

      const email = sessionCookie.slice(SESSION_PREFIX.length)

      return {uid: `uid-of-${email}`, email}
    },
  }
}
