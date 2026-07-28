import type {Db} from '../../commons/db.ts'
import {currentLanguage} from '../../commons/i18n.ts'
import type {AuthError, FirebaseAuth, Session} from '../../services/firebase-auth.ts'
import {ensureUser} from '../user/model.ts'

export type LogInResult = {session: Session} | {error: AuthError}

/** Codes, never display text: the view is what turns them into something a person reads */
export type RegistrationError =
  'invalid-email' | 'weak-password' | 'passwords-do-not-match' | 'unavailable'

export type RegistrationResult = {registered: true} | {error: RegistrationError}

export type PasswordResetError = 'invalid-email' | 'too-many-attempts' | 'unavailable'

export type PasswordResetResult = {sent: true} | {error: PasswordResetError}

export const PASSWORD_MIN_LENGTH = 8

// deliberately undemanding: length is the password rule that reliably helps, while rules about
// symbols and digits mostly push people towards a password they have already used elsewhere
const EMAIL_REGEXP = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Signs the user in with Firebase and trades the resulting ID token for a session cookie. The
 * password never leaves this request: it is sent to Firebase and forgotten.
 */
export async function logInWithPassword(
  auth: FirebaseAuth,
  db: Db,
  email: string,
  password: string,
): Promise<LogInResult> {
  const signIn = await auth.signInWithPassword(email.trim(), password)

  if ('error' in signIn) {
    return signIn
  }

  const result = await logInWithIdToken(auth, db, signIn.idToken)

  // whoever is at the keyboard has just proved they know the password of an account whose address
  // has never been confirmed, so they are sent the link again. This is why there is no "resend"
  // page: doing it here means the ID token is used where it already is, and never stored anywhere.
  if ('error' in result && result.error === 'email-not-verified') {
    await auth.sendVerificationEmail(signIn.idToken)
  }

  return result
}

/**
 * Turns an ID token that the browser obtained itself (Google sign-in) into a session cookie. The
 * token is only ever trusted after Firebase has verified its signature.
 */
export async function logInWithIdToken(
  auth: FirebaseAuth,
  db: Db,
  idToken: string,
): Promise<LogInResult> {
  const session = await auth.createSession(idToken)

  if ('error' in session) {
    return session
  }

  // a user can exist in Firebase without ever having been through this app's registration — added
  // by hand in the console, or created by Firebase itself on a first Google sign-in — so the row is
  // made here too, seeded with the language this request is being served in
  await ensureUser(db, session.user.uid, {language: currentLanguage()})

  return {session}
}

/**
 * Everything that can be decided about a registration without asking Firebase. Pure, so that the
 * rules are unit-testable and are the same however the form was filled in.
 */
export function validateRegistration({
  email,
  password,
  confirmPassword,
}: {
  email: string
  password: string
  confirmPassword: string
}): RegistrationError | undefined {
  if (!EMAIL_REGEXP.test(email.trim())) {
    return 'invalid-email'
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return 'weak-password'
  }

  return password === confirmPassword ? undefined : 'passwords-do-not-match'
}

/**
 * Creates a Firebase user and has Firebase send them its own verification email. The account exists
 * from this moment, but cannot be logged in with until that email has been clicked.
 *
 * An address that already has an account is answered exactly like a new one — and is sent a
 * password-reset email instead — so that registration cannot be used to find out who has an account
 * here. Their row is created the next time they log in.
 */
export async function registerUser(
  auth: FirebaseAuth,
  db: Db,
  {email, password, confirmPassword}: {email: string; password: string; confirmPassword: string},
): Promise<RegistrationResult> {
  const invalid = validateRegistration({email, password, confirmPassword})

  if (invalid !== undefined) {
    return {error: invalid}
  }

  const trimmedEmail = email.trim()
  const created = await auth.createUser(trimmedEmail, password)

  if ('error' in created) {
    if (created.error === 'email-already-in-use') {
      await auth.sendPasswordResetEmail(trimmedEmail)

      return {registered: true}
    }

    return {error: created.error === 'weak-password' ? 'weak-password' : 'unavailable'}
  }

  await ensureUser(db, created.uid, {language: currentLanguage()})

  const signIn = await auth.signInWithPassword(trimmedEmail, password)

  if ('error' in signIn) {
    return {error: 'unavailable'}
  }

  return (await auth.sendVerificationEmail(signIn.idToken)) === undefined
    ? {registered: true}
    : {error: 'unavailable'}
}

/**
 * Has Firebase send its own "set a new password" message. Nothing here is stored: the link in the
 * mail is handled by Firebase's action page, exactly as the verification link is.
 *
 * An address with no account is answered exactly like one that has an account — Firebase rejects it
 * with the same code it uses for a wrong password, and that is deliberately swallowed — so that
 * this page cannot be used to find out who has an account here.
 */
export async function requestPasswordReset(
  auth: FirebaseAuth,
  email: string,
): Promise<PasswordResetResult> {
  const trimmedEmail = email.trim()

  if (!EMAIL_REGEXP.test(trimmedEmail)) {
    return {error: 'invalid-email'}
  }

  const result = await auth.sendPasswordResetEmail(trimmedEmail)

  if (result !== undefined && result.error !== 'invalid-credentials') {
    return {error: result.error === 'too-many-attempts' ? 'too-many-attempts' : 'unavailable'}
  }

  return {sent: true}
}
