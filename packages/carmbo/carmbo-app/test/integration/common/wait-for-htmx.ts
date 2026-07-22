import type {Page, Request} from '@playwright/test'

// How long the htmx network must stay quiet (no htmx request starting or
// finishing) before a step is considered done. Must comfortably exceed the
// `delay:...` on htmx triggers (the form uses `change delay:1ms`) so a delayed
// request (e.g. a form re-render) can't start *after* a faster, un-delayed
// request (e.g. a datalist fetch) has already finished.
const QUIET_PERIOD_MS = 20

// Safety cap so a genuinely stuck step fails with a clear error rather than
// hanging until the Playwright test timeout.
const MAX_WAIT_MS = 6000

/**
 * Runs `f` and then waits until htmx has gone quiet: every htmx request it
 * triggered has finished and no new one has started for {@link QUIET_PERIOD_MS}.
 *
 * Requests are tracked at the network layer (via Playwright request events)
 * rather than via in-page htmx events, because a submit that re-renders the
 * whole page into `<body>` re-loads htmx.min.js and drops its `afterSettle` /
 * `afterRequest` events. This also tolerates actions that trigger no request at
 * all (e.g. a submit that htmx halts because the form is invalid).
 */
export async function waitForHtmx<T>(page: Page, f: () => Promise<T>): Promise<T> {
  let inFlight = 0
  let lastActivity = Date.now()

  const isHtmxRequest = (request: Request) => request.headers()['hx-request'] === 'true'
  const onRequest = (request: Request) => {
    if (isHtmxRequest(request)) {
      inFlight++
      lastActivity = Date.now()
    }
  }
  const onRequestDone = (request: Request) => {
    if (isHtmxRequest(request)) {
      inFlight = Math.max(0, inFlight - 1)
      lastActivity = Date.now()
    }
  }

  page.on('request', onRequest)
  page.on('requestfinished', onRequestDone)
  page.on('requestfailed', onRequestDone)

  try {
    const ret = await f()

    // Measure the quiet window from *after* the action, so a request triggered
    // with a small `delay` still resets the window before we give up.
    lastActivity = Date.now()
    const deadline = Date.now() + MAX_WAIT_MS
    for (;;) {
      if (inFlight === 0 && Date.now() - lastActivity >= QUIET_PERIOD_MS) break
      if (Date.now() > deadline) {
        throw new Error(
          `waitForHtmx: htmx did not go quiet within ${MAX_WAIT_MS}ms (inFlight=${inFlight})`,
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    return ret
  } finally {
    page.off('request', onRequest)
    page.off('requestfinished', onRequestDone)
    page.off('requestfailed', onRequestDone)
  }
}
