// Google sign-in has to happen in the browser, so this is the one page with client-side code. The
// Firebase Web SDK is loaded as an ES module straight from Google's CDN, and only once the user
// actually asks for it, so the login page itself stays small and the app stays free of a bundler.
const FIREBASE_VERSION = '12.16.0'

const container = document.querySelector('#google-sign-in')
const button = document.querySelector('#google-sign-in-button')
const errorElement = document.querySelector('#google-sign-in-error')

if (
  container instanceof HTMLElement &&
  button instanceof HTMLButtonElement &&
  errorElement instanceof HTMLElement
) {
  const signInContainer = container
  const signInButton = button
  const signInError = errorElement

  signInButton.addEventListener('click', () =>
    signInWithGoogle(signInContainer, signInButton, signInError),
  )
}

/**
 * @param {HTMLElement} container
 * @param {HTMLButtonElement} button
 * @param {HTMLElement} errorElement
 * @returns {Promise<void>}
 */
async function signInWithGoogle(container, button, errorElement) {
  button.disabled = true
  errorElement.hidden = true

  try {
    const [{initializeApp}, {getAuth, GoogleAuthProvider, signInWithPopup}] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
    ])

    const app = initializeApp({
      apiKey: container.dataset.apiKey,
      authDomain: container.dataset.authDomain,
      projectId: container.dataset.projectId,
    })

    const credential = await signInWithPopup(getAuth(app), new GoogleAuthProvider())
    const idToken = await credential.user.getIdToken()

    // the ID token is handed to the server rather than kept here: the server verifies it and
    // answers with an HttpOnly session cookie, which no script on this page can read
    const response = await fetch('/login/session', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({idToken}),
    })

    if (!response.ok) {
      throw new Error(`the server refused the sign-in: ${response.status}`)
    }

    window.location.assign('/')
  } catch (error) {
    button.disabled = false

    // closing the popup is a decision, not a failure, so it is not reported as one
    if (isPopupCancellation(error)) {
      return
    }

    console.error(error)
    errorElement.hidden = false
  }
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isPopupCancellation(error) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''

  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
}
