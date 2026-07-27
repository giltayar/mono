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
const SEND_OOB_CODE_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode'

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

  /** A call to the Identity Toolkit REST API, which is the half of Firebase the admin SDK does not do */
  async function identityToolkit(
    url: string,
    body: unknown,
  ): Promise<{response: Response} | {error: AuthError}> {
    let response: Response

    try {
      response = await fetch(`${url}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(body),
      })
    } catch {
      return {error: 'unavailable'}
    }

    return response.ok ? {response} : {error: await identityToolkitError(response)}
  }

  return {
    async createUser(email, password) {
      try {
        const {uid} = await auth.createUser({email, password})

        return {uid}
      } catch (error) {
        return {error: createUserErrorOf(error)}
      }
    },

    async signInWithPassword(email, password) {
      const result = await identityToolkit(SIGN_IN_URL, {email, password, returnSecureToken: true})

      if ('error' in result) {
        return result
      }

      const {idToken} = (await result.response.json()) as {idToken?: string}

      return idToken === undefined ? {error: 'unavailable'} : {idToken}
    },

    async sendVerificationEmail(idToken) {
      // Firebase composes and sends the mail itself, from the template in its console, which is
      // why this app needs no mail service of its own
      const result = await identityToolkit(SEND_OOB_CODE_URL, {
        requestType: 'VERIFY_EMAIL',
        idToken,
      })

      return 'error' in result ? result : undefined
    },

    async sendPasswordResetEmail(email) {
      const result = await identityToolkit(SEND_OOB_CODE_URL, {
        requestType: 'PASSWORD_RESET',
        email,
      })

      return 'error' in result ? result : undefined
    },

    async createSession(idToken) {
      try {
        const claims = await auth.verifyIdToken(idToken)

        // an address nobody has proved they can read is not an identity, so it never becomes a
        // session. Google sign-ins arrive already verified.
        if (!claims.email_verified) {
          return {error: 'email-not-verified'}
        }

        // only a sign-in that just happened may be traded for a long-lived session cookie, so that
        // a leaked ID token cannot be turned into a session days later
        if (Date.now() / 1000 - claims.auth_time > MAX_SIGN_IN_AGE_IN_SECONDS) {
          return {error: 'invalid-credentials'}
        }

        return {
          cookie: await auth.createSessionCookie(idToken, {
            expiresIn: SESSION_MAX_AGE_IN_SECONDS * 1000,
          }),
          maxAgeInSeconds: SESSION_MAX_AGE_IN_SECONDS,
          user: {uid: claims.uid, email: claims.email, displayName: claims.name},
        }
      } catch {
        return {error: 'invalid-credentials'}
      }
    },

    async verifySession(cookie) {
      try {
        const claims = await auth.verifySessionCookie(cookie)

        // checked here too, and not only when the session is minted, so that a session handed out
        // before the address was un-verified stops working immediately
        if (!claims.email_verified) {
          return undefined
        }

        return {uid: claims.uid, email: claims.email, displayName: claims.name}
      } catch {
        return undefined
      }
    },
  }
}

function createUserErrorOf(error: unknown): AuthError {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : ''

  if (code === 'auth/email-already-exists') {
    return 'email-already-in-use'
  }

  if (code === 'auth/invalid-password') {
    return 'weak-password'
  }

  return code === 'auth/invalid-email' ? 'invalid-credentials' : 'unavailable'
}

async function identityToolkitError(response: Response): Promise<AuthError> {
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
