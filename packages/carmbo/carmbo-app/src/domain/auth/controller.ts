import {finalHtml, type ControllerResult} from '../../commons/controller-result.ts'
import {exceptionToBanner} from '../../layout/banner.ts'
import {
  createSessionCookie,
  revokeRefreshTokens,
  signInWithEmailPassword,
  verifySessionCookie,
} from './model-firebase.ts'
import {LoginPage, LogoutFailedPage} from './view-login.ts'

export function showLoginPage(): ControllerResult {
  return finalHtml(LoginPage({}))
}

export async function login(
  email: string,
  password: string,
  firebaseApiKey: string,
): Promise<{result: ControllerResult; sessionCookie: string | undefined}> {
  try {
    const idToken = await signInWithEmailPassword(firebaseApiKey, email, password)
    const sessionCookie = await createSessionCookie(idToken)

    return {result: {htmxRedirect: '/'}, sessionCookie}
  } catch (error) {
    const banner = exceptionToBanner('', error, {
      errorCodeNs: 'auth',
      defaultErrorCode: 'loginFailed',
      errorScope: 'login.errors',
    })

    return {result: finalHtml(LoginPage({banner})), sessionCookie: undefined}
  }
}

export async function logout(sessionCookie: string | undefined): Promise<ControllerResult> {
  if (sessionCookie) {
    try {
      const user = await verifySessionCookie(sessionCookie)
      if (user) {
        await revokeRefreshTokens(user.uid)
      }
    } catch (error) {
      return finalHtml(LogoutFailedPage({banner: exceptionToBanner('', error)}))
    }
  }

  return {htmxRedirect: '/auth/login'}
}
