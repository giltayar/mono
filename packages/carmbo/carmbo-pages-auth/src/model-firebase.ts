import {makeError} from '@giltayar/functional-commons'
import {initializeApp, cert} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {createSessionCookieVerifier, type SessionCookieVerifier} from './session-cookie-verifier.ts'

const SESSION_COOKIE_EXPIRES_IN = 14 * 24 * 60 * 60 * 1000

interface FirebaseAuth {
  createSessionCookie(idToken: string, options: {expiresIn: number}): Promise<string>
  verifySessionCookie(
    sessionCookie: string,
    checkRevoked?: boolean,
  ): Promise<{uid: string; email?: string}>
  revokeRefreshTokens(uid: string): Promise<void>
}

let firebaseAuth: FirebaseAuth
let sessionCookieVerifier: SessionCookieVerifier
let signInWithPasswordUrl = new URL(
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
)

export function initializeFirebase(serviceAccountJson: string): void {
  const serviceAccount = JSON.parse(serviceAccountJson)
  const firebaseApp = initializeApp({credential: cert(serviceAccount)})
  firebaseAuth = getAuth(firebaseApp)
  sessionCookieVerifier = createSessionCookieVerifier(firebaseAuth)
}

export function TEST_setFirebaseAuth(auth: FirebaseAuth, testSignInWithPasswordUrl: URL): void {
  firebaseAuth = auth
  sessionCookieVerifier = createSessionCookieVerifier(firebaseAuth)
  signInWithPasswordUrl = new URL(testSignInWithPasswordUrl)
}

export async function signInWithEmailPassword(
  apiKey: string,
  email: string,
  password: string,
): Promise<string> {
  const requestUrl = new URL(signInWithPasswordUrl)
  requestUrl.searchParams.set('key', apiKey)
  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password, returnSecureToken: true}),
  })

  if (!response.ok) {
    const error = await response.json()
    throw makeError(error.error?.message ?? 'UNKNOWN_ERROR', {
      code: error.error?.message === 'INVALID_LOGIN_CREDENTIALS' ? 'invalidCredentials' : undefined,
    })
  }

  const data = (await response.json()) as {idToken: string}
  return data.idToken
}

export async function createSessionCookie(idToken: string): Promise<string> {
  return firebaseAuth.createSessionCookie(idToken, {expiresIn: SESSION_COOKIE_EXPIRES_IN})
}

export async function verifySessionCookie(
  sessionCookie: string,
): Promise<{uid: string; email?: string} | undefined> {
  return sessionCookieVerifier.verify(sessionCookie)
}

export async function revokeRefreshTokens(uid: string): Promise<void> {
  await firebaseAuth.revokeRefreshTokens(uid)
  sessionCookieVerifier.invalidate(uid)
}
