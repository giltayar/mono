import {makeError} from '@giltayar/functional-commons'
import {initializeApp, cert, type App} from 'firebase-admin/app'
import {getAuth, type Auth} from 'firebase-admin/auth'

const SESSION_COOKIE_EXPIRES_IN = 14 * 24 * 60 * 60 * 1000 // 14 days in ms

let firebaseApp: App
let firebaseAuth: Auth

export function initializeFirebase(serviceAccountJson: string) {
  const serviceAccount = JSON.parse(serviceAccountJson)
  firebaseApp = initializeApp({credential: cert(serviceAccount)})
  firebaseAuth = getAuth(firebaseApp)
}

export async function signInWithEmailPassword(
  apiKey: string,
  email: string,
  password: string,
): Promise<string> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email, password, returnSecureToken: true}),
    },
  )

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
  try {
    const decoded = await firebaseAuth.verifySessionCookie(sessionCookie, true)
    return {uid: decoded.uid, email: decoded.email}
  } catch {
    return undefined
  }
}

export async function revokeRefreshTokens(uid: string): Promise<void> {
  await firebaseAuth.revokeRefreshTokens(uid)
}
