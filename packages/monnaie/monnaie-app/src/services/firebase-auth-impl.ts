import crypto from 'node:crypto'
import {cert, initializeApp} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import type {AuthError, FirebaseAuth} from './firebase-auth.ts'

/** The private half of the Firebase configuration — never sent to the browser */
export type FirebaseServiceAccount = {
  projectId: string
  clientEmail: string
  privateKey: string
}

/** Firebase caps session cookies at 14 days */
const SESSION_MAX_AGE_IN_SECONDS = 5 * 24 * 60 * 60
const MAX_SIGN_IN_AGE_IN_SECONDS = 5 * 60
const SIGN_IN_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword'

export function createFirebaseAuth({
  serviceAccount,
  apiKey,
}: {
  serviceAccount: FirebaseServiceAccount
  apiKey: string
}): FirebaseAuth {
  // named uniquely, so that creating two apps in the same process (as the tests do) does not throw
  const auth = getAuth(
    initializeApp({credential: cert(serviceAccount)}, `monnaie-${crypto.randomUUID()}`),
  )

  return {
    async signInWithPassword(email, password) {
      let response: Response

      try {
        response = await fetch(`${SIGN_IN_URL}?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({email, password, returnSecureToken: true}),
        })
      } catch {
        return {error: 'unavailable'}
      }

      if (!response.ok) {
        return {error: await signInErrorOf(response)}
      }

      const {idToken} = (await response.json()) as {idToken?: string}

      return idToken === undefined ? {error: 'unavailable'} : {idToken}
    },

    async createSession(idToken) {
      try {
        const {auth_time: authTime} = await auth.verifyIdToken(idToken)

        // only a sign-in that just happened may be traded for a long-lived session cookie, so that
        // a leaked ID token cannot be turned into a session days later
        if (Date.now() / 1000 - authTime > MAX_SIGN_IN_AGE_IN_SECONDS) {
          return {error: 'invalid-credentials'}
        }

        return {
          cookie: await auth.createSessionCookie(idToken, {
            expiresIn: SESSION_MAX_AGE_IN_SECONDS * 1000,
          }),
          maxAgeInSeconds: SESSION_MAX_AGE_IN_SECONDS,
        }
      } catch {
        return {error: 'invalid-credentials'}
      }
    },

    async verifySession(cookie) {
      try {
        const claims = await auth.verifySessionCookie(cookie)

        return {uid: claims.uid, email: claims.email, displayName: claims.name}
      } catch {
        return undefined
      }
    },
  }
}

async function signInErrorOf(response: Response): Promise<AuthError> {
  const message = await identityToolkitErrorMessage(response)

  if (message.startsWith('TOO_MANY_ATTEMPTS_TRY_LATER')) {
    return 'too-many-attempts'
  }

  // every other rejection is reported identically — an unknown email, a wrong password and a
  // disabled user must be indistinguishable, or the login page becomes an account oracle
  return response.status >= 400 && response.status < 500 ? 'invalid-credentials' : 'unavailable'
}

async function identityToolkitErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {error?: {message?: unknown}}

    return typeof body.error?.message === 'string' ? body.error.message : ''
  } catch {
    return ''
  }
}
