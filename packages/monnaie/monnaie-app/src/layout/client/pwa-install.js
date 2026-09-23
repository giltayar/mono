/**
 * @typedef {Event & {
 *   prompt: () => Promise<void>
 *   userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>
 * }} InstallPromptEvent
 */

const installSection = document.querySelector('#install-app')
const installButton = document.querySelector('#install-app-button')
const iosInstructions = document.querySelector('#install-ios-instructions')

/** @type {InstallPromptEvent | undefined} */
let installPrompt

const navigatorWithStandalone = /** @type {Navigator & {standalone?: boolean}} */ (
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  navigator
)
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  navigatorWithStandalone.standalone === true
const isIos =
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

function hideInstallSection() {
  if (installSection instanceof HTMLElement) installSection.hidden = true
}

if (!isStandalone && isIos && installSection instanceof HTMLElement) {
  installSection.hidden = false
  if (iosInstructions instanceof HTMLElement) iosInstructions.hidden = false
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  installPrompt = /** @type {InstallPromptEvent} */ (event)

  if (installSection instanceof HTMLElement) installSection.hidden = false
  if (installButton instanceof HTMLButtonElement) installButton.hidden = false
})

if (installButton instanceof HTMLButtonElement) {
  installButton.addEventListener('click', async () => {
    if (installPrompt === undefined) return

    await installPrompt.prompt()
    await installPrompt.userChoice
    installPrompt = undefined
    hideInstallSection()
  })
}

window.addEventListener('appinstalled', hideInstallSection)
