import {initializeApp} from 'firebase/app'
import {getAuth, signInWithEmailAndPassword} from 'firebase/auth'

type LoginConfig = {
  firebase: {apiKey: string; authDomain: string; projectId: string}
  /** The page the user was on before being sent here */
  next: string
  errors: {invalidCredentials: string; tooManyRequests: string; unexpected: string}
}

const form = document.querySelector('#login-form') as HTMLFormElement
const errorElement = document.querySelector('#login-error') as HTMLElement
const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement

const config = JSON.parse(form.dataset['loginConfig'] as string) as LoginConfig
const auth = getAuth(initializeApp(config.firebase))

form.addEventListener('submit', async (event) => {
  event.preventDefault()

  const {email, password} = Object.fromEntries(new FormData(form)) as Record<string, string>

  errorElement.textContent = ''
  submitButton.disabled = true

  try {
    // the password never reaches our server: the identity provider hands the browser an ID token,
    // and only that token is sent to us, in exchange for a session cookie
    const {user} = await signInWithEmailAndPassword(auth, email, password)

    const response = await fetch('/session', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({idToken: await user.getIdToken()}),
    })

    if (!response.ok) {
      throw new Error(`could not create a session: ${response.status}`)
    }

    location.assign(config.next)
  } catch (error) {
    errorElement.textContent = messageOf(error, config.errors)
    submitButton.disabled = false
  }
})

function messageOf(error: unknown, errors: LoginConfig['errors']): string {
  const code = (error as {code?: string}).code

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-email':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return errors.invalidCredentials
    case 'auth/too-many-requests':
      return errors.tooManyRequests
    default:
      return errors.unexpected
  }
}
