import type {Page} from '@playwright/test'

export async function initializeHtmxSettled(page: Page) {
  await page.evaluate(() => {
    // console.log('****** Initializing htmx settled state for testing...')
    // htmx.logAll();
    ;(window as any).TEST_isHtmxSettled = false
    const cleanupListener = new AbortController()

    window.addEventListener(
      'htmx:afterSettle',
      () => {
        ;(window as any).TEST_isHtmxSettled = true
        cleanupListener.abort()
      },
      {signal: cleanupListener.signal},
    )
  })

  return () => page.waitForFunction(() => (window as any).TEST_isHtmxSettled === true)
}
