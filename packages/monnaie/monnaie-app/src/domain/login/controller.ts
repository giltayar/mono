import {clearedSessionCookie, currentUser, LOGIN_PATH, sessionCookie} from '../../commons/auth.ts'
import type {ControllerResult} from '../../commons/controller.ts'
import type {Db} from '../../commons/db.ts'
import type {FirebaseAuth, PublicFirebaseConfig, Session} from '../../services/firebase-auth.ts'
import {logInWithIdToken, logInWithPassword, registerUser, requestPasswordReset} from './model.ts'
import {renderLoginPage} from './view/view.ts'
import {renderRegistrationPage, renderVerificationSentPage} from './view/registration-view.ts'
import {renderForgotPasswordPage, renderPasswordResetSentPage} from './view/forgot-password-view.ts'

const HOME_PATH = '/'

export async function showLoginPage(config: PublicFirebaseConfig): Promise<ControllerResult> {
  if (currentUser() !== undefined) {
    return {html: '', statusCode: 303, headers: {Location: HOME_PATH}}
  }

  return {html: renderLoginPage(config, {error: undefined})}
}

export async function logIn(
  auth: FirebaseAuth,
  db: Db,
  config: PublicFirebaseConfig,
  {email, password}: {email: string; password: string},
): Promise<ControllerResult> {
  const result = await logInWithPassword(auth, db, email, password)

  if ('error' in result) {
    return {html: renderLoginPage(config, {error: result.error}), statusCode: 401}
  }

  return sessionStarted(result.session)
}

/**
 * The other half of Google sign-in: the browser did the sign-in and posts the ID token here. The
 * response carries no HTML — the client navigates once the session cookie is set.
 */
export async function logInWithGoogle(
  auth: FirebaseAuth,
  db: Db,
  idToken: string,
): Promise<ControllerResult> {
  const result = await logInWithIdToken(auth, db, idToken)

  if ('error' in result) {
    return {html: '', statusCode: 401}
  }

  return {html: '', headers: {'Set-Cookie': sessionCookie(result.session)}}
}

export async function showRegistrationPage(): Promise<ControllerResult> {
  if (currentUser() !== undefined) {
    return {html: '', statusCode: 303, headers: {Location: HOME_PATH}}
  }

  return {html: renderRegistrationPage({error: undefined, email: ''})}
}

export async function register(
  auth: FirebaseAuth,
  db: Db,
  body: {email: string; password: string; confirmPassword: string},
): Promise<ControllerResult> {
  const result = await registerUser(auth, db, body)

  if ('error' in result) {
    // the email is handed back so that a mistyped password does not cost the user the whole form;
    // the passwords deliberately are not
    return {html: renderRegistrationPage({error: result.error, email: body.email}), statusCode: 400}
  }

  return {html: renderVerificationSentPage(body.email.trim())}
}

export async function showForgotPasswordPage(): Promise<ControllerResult> {
  if (currentUser() !== undefined) {
    return {html: '', statusCode: 303, headers: {Location: HOME_PATH}}
  }

  return {html: renderForgotPasswordPage({error: undefined, email: ''})}
}

export async function resetPassword(
  auth: FirebaseAuth,
  {email}: {email: string},
): Promise<ControllerResult> {
  const result = await requestPasswordReset(auth, email)

  if ('error' in result) {
    return {html: renderForgotPasswordPage({error: result.error, email}), statusCode: 400}
  }

  return {html: renderPasswordResetSentPage(email.trim())}
}

export async function logOut(): Promise<ControllerResult> {
  return {
    html: '',
    statusCode: 303,
    headers: {
      // a fixed path, and never anything taken from the request, so that this cannot be turned
      // into an open redirect
      Location: LOGIN_PATH,
      'Set-Cookie': clearedSessionCookie(),
    },
  }
}

function sessionStarted(session: Session): ControllerResult {
  return {
    html: '',
    statusCode: 303,
    headers: {Location: HOME_PATH, 'Set-Cookie': sessionCookie(session)},
  }
}
