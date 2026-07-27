/**
 * The contract between the app and Firebase Authentication. It is an interface with no
 * implementation — that lives in `firebase-auth-impl.ts` — so that nothing but that one file
 * depends on `firebase-admin`, and so that the integration tests can run the whole app against
 * `test/integration/services/fake-firebase-auth.ts` instead, with no Firebase project and no
 * network.
 */
export type FirebaseAuth = {
  /** Creates a user with an unverified email, which cannot be signed in with until it is verified */
  createUser(email: string, password: string): Promise<{uid: string} | {error: AuthError}>
  /** Exchanges an email/password for a freshly-issued ID token */
  signInWithPassword(
    email: string,
    password: string,
  ): Promise<{idToken: string} | {error: AuthError}>
  /**
   * Asks Firebase to send its own "verify your email" message to the owner of `idToken`. The link
   * in it is handled by Firebase's action page, so this app never sees the user click it.
   */
  sendVerificationEmail(idToken: string): Promise<undefined | {error: AuthError}>
  /**
   * Asks Firebase to send its own password-reset message. Used to tell somebody who tried to
   * register with an address that already has an account, without telling the *browser* that.
   */
  sendPasswordResetEmail(email: string): Promise<undefined | {error: AuthError}>
  /** Exchanges an ID token that proves a recent sign-in for a long-lived session cookie */
  createSession(idToken: string): Promise<Session | {error: AuthError}>
  /** The user of a session cookie, or `undefined` if it is expired, revoked or forged */
  verifySession(cookie: string): Promise<AuthenticatedUser | undefined>
}

/** The user a session cookie belongs to */
export type AuthenticatedUser = {
  uid: string
  email: string | undefined
  displayName: string | undefined
}

/** Translated by the view layer, so that no display text leaks into the model */
export type AuthError =
  | 'invalid-credentials'
  | 'too-many-attempts'
  | 'unavailable'
  | 'email-already-in-use'
  | 'weak-password'
  | 'email-not-verified'

/** A minted Firebase session cookie, how long the browser should hold on to it, and whose it is */
export type Session = {cookie: string; maxAgeInSeconds: number; user: AuthenticatedUser}

/** The half of the Firebase configuration that is meant to be public, and is sent to the browser */
export type PublicFirebaseConfig = {
  apiKey: string
  authDomain: string
  projectId: string
}
