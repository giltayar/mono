import type {AuthError, FirebaseAuth, Session} from '../../services/firebase-auth.ts'

export type LogInResult = {session: Session} | {error: AuthError}

/**
 * Signs the user in with Firebase and trades the resulting ID token for a session cookie. The
 * password never leaves this request: it is sent to Firebase and forgotten.
 */
export async function logInWithPassword(
  auth: FirebaseAuth,
  email: string,
  password: string,
): Promise<LogInResult> {
  const signIn = await auth.signInWithPassword(email.trim(), password)

  if ('error' in signIn) {
    return signIn
  }

  return await logInWithIdToken(auth, signIn.idToken)
}

/**
 * Turns an ID token that the browser obtained itself (Google sign-in) into a session cookie. The
 * token is only ever trusted after Firebase has verified its signature.
 */
export async function logInWithIdToken(auth: FirebaseAuth, idToken: string): Promise<LogInResult> {
  const session = await auth.createSession(idToken)

  if ('error' in session) {
    return session
  }

  return {session}
}
