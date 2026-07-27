import crypto from 'node:crypto'
import type {
  AuthenticatedUser,
  FirebaseAuth,
  PublicFirebaseConfig,
} from '../../../src/services/firebase-auth.ts'

export type FakeUser = {uid: string; email: string; password: string; displayName?: string}

export const FIRST_USER: FakeUser = {
  uid: 'first-user',
  email: 'first@example.com',
  password: 'first-password',
  displayName: 'First User',
}

export const SECOND_USER: FakeUser = {
  uid: 'second-user',
  email: 'second@example.com',
  password: 'second-password',
}

export const FAKE_USERS = [FIRST_USER, SECOND_USER]

/** Nothing here reaches Firebase, so the values only have to look like a configuration */
export const FAKE_FIREBASE_CONFIG: PublicFirebaseConfig = {
  apiKey: 'fake-api-key',
  authDomain: 'fake-project.firebaseapp.com',
  projectId: 'fake-project',
}

/**
 * Firebase Authentication, minus Firebase: it holds the users in memory and hands out opaque tokens
 * and cookies, so that the integration tests can exercise the whole of the app — including who is
 * allowed to see what — without a Firebase project and without the network.
 */
export function createFakeFirebaseAuth(users: FakeUser[] = FAKE_USERS): FirebaseAuth {
  const usersByIdToken = new Map<string, AuthenticatedUser>()
  const usersBySessionCookie = new Map<string, AuthenticatedUser>()

  return {
    async signInWithPassword(email, password) {
      const user = users.find((user) => user.email === email && user.password === password)

      if (user === undefined) {
        return {error: 'invalid-credentials'}
      }

      const idToken = `fake-id-token-${crypto.randomUUID()}`

      usersByIdToken.set(idToken, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      })

      return {idToken}
    },

    async createSession(idToken) {
      const user = usersByIdToken.get(idToken)

      if (user === undefined) {
        return {error: 'invalid-credentials'}
      }

      const cookie = `fake-session-${crypto.randomUUID()}`

      usersBySessionCookie.set(cookie, user)

      return {cookie, maxAgeInSeconds: 60 * 60}
    },

    async verifySession(cookie) {
      return usersBySessionCookie.get(cookie)
    },
  }
}
