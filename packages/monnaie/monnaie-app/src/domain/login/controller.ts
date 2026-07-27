import {clearedSessionCookie, currentUser, LOGIN_PATH, sessionCookie} from '../../commons/auth.ts'
import type {ControllerResult} from '../../commons/controller.ts'
import type {FirebaseAuth, PublicFirebaseConfig, Session} from '../../services/firebase-auth.ts'
import {logInWithIdToken, logInWithPassword} from './model.ts'
import {renderLoginPage} from './view/view.ts'

const HOME_PATH = '/'

export async function showLoginPage(config: PublicFirebaseConfig): Promise<ControllerResult> {
  if (currentUser() !== undefined) {
    return {html: '', statusCode: 303, headers: {Location: HOME_PATH}}
  }

  return {html: renderLoginPage(config)}
}

export async function logIn(
  auth: FirebaseAuth,
  config: PublicFirebaseConfig,
  {email, password}: {email: string; password: string},
): Promise<ControllerResult> {
  const result = await logInWithPassword(auth, email, password)

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
  idToken: string,
): Promise<ControllerResult> {
  const result = await logInWithIdToken(auth, idToken)

  if ('error' in result) {
    return {html: '', statusCode: 401}
  }

  return {html: '', headers: {'Set-Cookie': sessionCookie(result.session)}}
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
