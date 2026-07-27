import crypto from 'node:crypto'
import type {
  AuthenticatedUser,
  FirebaseAuth,
  PublicFirebaseConfig,
} from '../../../src/services/firebase-auth.ts'

export type FakeUser = {
  uid: string
  email: string
  password: string
  displayName?: string
  /** Users made in the Firebase console start out unverified, just as they do here */
  emailVerified?: boolean
}

export const FIRST_USER: FakeUser = {
  uid: 'first-user',
  email: 'first@example.com',
  password: 'first-password',
  displayName: 'First User',
  emailVerified: true,
}

export const SECOND_USER: FakeUser = {
  uid: 'second-user',
  email: 'second@example.com',
  password: 'second-password',
  emailVerified: true,
}

export const FAKE_USERS = [FIRST_USER, SECOND_USER]

/** What Firebase would have put in somebody's inbox */
export type SentEmail = {type: 'verification' | 'password-reset'; email: string}

export type FakeFirebaseAuth = FirebaseAuth & {
  /** Every mail Firebase would have sent, in order, so that a test can assert on it */
  sentEmails: () => SentEmail[]
  /** Stands in for the user clicking the link in the verification mail */
  markVerified: (email: string) => void
  /** A user who appeared in Firebase without going through this app — added in the console */
  addUser: (user: FakeUser) => void
  users: () => FakeUser[]
  /** Back to the users and the empty inbox this was created with */
  reset: () => void
}

/** Nothing here reaches Firebase, so the values only have to look like a configuration */
export const FAKE_FIREBASE_CONFIG: PublicFirebaseConfig = {
  apiKey: 'fake-api-key',
  authDomain: 'fake-project.firebaseapp.com',
  projectId: 'fake-project',
}

/**
 * Firebase Authentication, minus Firebase: it holds the users in memory and hands out opaque tokens
 * and cookies, so that the integration tests can exercise the whole of the app — including who is
 * allowed to see what, and who has confirmed their email — without a Firebase project and without
 * the network.
 */
export function createFakeFirebaseAuth(initialUsers: FakeUser[] = FAKE_USERS): FakeFirebaseAuth {
  // copied, so that a user registered by one test is not still there in the next
  let users = initialUsers.map((user) => ({...user}))
  let sentEmails: SentEmail[] = []
  const usersByIdToken = new Map<string, FakeUser>()
  const usersBySessionCookie = new Map<string, FakeUser>()

  function authenticatedUserOf(user: FakeUser): AuthenticatedUser {
    return {uid: user.uid, email: user.email, displayName: user.displayName}
  }

  return {
    async createUser(email, password) {
      if (users.some((user) => user.email === email)) {
        return {error: 'email-already-in-use'}
      }

      const user = {uid: `user-${crypto.randomUUID()}`, email, password, emailVerified: false}

      users.push(user)

      return {uid: user.uid}
    },

    async signInWithPassword(email, password) {
      const user = users.find((user) => user.email === email && user.password === password)

      if (user === undefined) {
        return {error: 'invalid-credentials'}
      }

      const idToken = `fake-id-token-${crypto.randomUUID()}`

      usersByIdToken.set(idToken, user)

      return {idToken}
    },

    async sendVerificationEmail(idToken) {
      const user = usersByIdToken.get(idToken)

      if (user === undefined) {
        return {error: 'invalid-credentials'}
      }

      sentEmails.push({type: 'verification', email: user.email})

      return undefined
    },

    async sendPasswordResetEmail(email) {
      sentEmails.push({type: 'password-reset', email})

      return undefined
    },

    async createSession(idToken) {
      const user = usersByIdToken.get(idToken)

      if (user === undefined) {
        return {error: 'invalid-credentials'}
      }

      if (user.emailVerified !== true) {
        return {error: 'email-not-verified'}
      }

      const cookie = `fake-session-${crypto.randomUUID()}`

      usersBySessionCookie.set(cookie, user)

      return {cookie, maxAgeInSeconds: 60 * 60, user: authenticatedUserOf(user)}
    },

    async verifySession(cookie) {
      const user = usersBySessionCookie.get(cookie)

      return user === undefined || user.emailVerified !== true
        ? undefined
        : authenticatedUserOf(user)
    },

    sentEmails: () => sentEmails,

    markVerified: (email) => {
      const user = users.find((user) => user.email === email)

      if (user === undefined) {
        throw new Error(`no fake user with the email ${email}`)
      }

      user.emailVerified = true
    },

    addUser: (user) => {
      users.push({...user})
    },

    users: () => users,

    reset: () => {
      users = initialUsers.map((user) => ({...user}))
      sentEmails = []
      usersByIdToken.clear()
      usersBySessionCookie.clear()
    },
  }
}
