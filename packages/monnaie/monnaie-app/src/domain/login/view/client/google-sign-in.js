// Google sign-in has to happen in the browser, so this is the one page with client-side code. The
// Firebase Web SDK is loaded as an ES module straight from Google's CDN without requiring a bundler.
const FIREBASE_VERSION = '12.16.0'

const container = document.querySelector('#google-sign-in')
const button = document.querySelector('#google-sign-in-button')
const errorElement = document.querySelector('#google-sign-in-error')
const popupBlockedErrorElement = document.querySelector('#google-sign-in-popup-blocked-error')

if (
  container instanceof HTMLElement &&
  button instanceof HTMLButtonElement &&
  errorElement instanceof HTMLElement &&
  popupBlockedErrorElement instanceof HTMLElement
) {
  initializeGoogleSignIn(container, button, errorElement, popupBlockedErrorElement).catch(
    (error) => {
      console.error(error)
      errorElement.hidden = false
    },
  )
}

/**
 * @param {HTMLElement} container
 * @param {HTMLButtonElement} button
 * @param {HTMLElement} errorElement
 * @param {HTMLElement} popupBlockedErrorElement
 * @returns {Promise<void>}
 */
async function initializeGoogleSignIn(container, button, errorElement, popupBlockedErrorElement) {
  const [{initializeApp}, {getAuth, GoogleAuthProvider, signInWithPopup}] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
  ])

  const app = initializeApp({
    apiKey: container.dataset.apiKey,
    authDomain: container.dataset.authDomain,
    projectId: container.dataset.projectId,
  })
  const auth = getAuth(app)
  const provider = new GoogleAuthProvider()

  button.disabled = false
  button.addEventListener('click', () => {
    const credentialPromise = signInWithPopup(auth, provider)
    void completeGoogleSignIn(credentialPromise, button, errorElement, popupBlockedErrorElement)
  })
}

/**
 * @param {Promise<{user: {getIdToken(): Promise<string>}}>} credentialPromise
 * @param {HTMLButtonElement} button
 * @param {HTMLElement} errorElement
 * @param {HTMLElement} popupBlockedErrorElement
 * @returns {Promise<void>}
 */
async function completeGoogleSignIn(
  credentialPromise,
  button,
  errorElement,
  popupBlockedErrorElement,
) {
  button.disabled = true
  errorElement.hidden = true
  popupBlockedErrorElement.hidden = true

  try {
    const credential = await credentialPromise
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
    if (errorCode(error) === 'auth/popup-blocked') {
      popupBlockedErrorElement.hidden = false
    } else {
      errorElement.hidden = false
    }
  }
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isPopupCancellation(error) {
  const code = errorCode(error)

  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function errorCode(error) {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
}
