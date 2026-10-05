import assert from 'node:assert/strict'
import {setTimeout as delay} from 'node:timers/promises'
import {test} from '@playwright/test'
import {waitForHtmx} from '../../src/playwright-commons.ts'

test('waits for an htmx request to finish and returns the action result', async ({page}) => {
  await page.route('https://example.test/htmx', async (route) => {
    await delay(100)
    await route.fulfill({
      body: 'ok',
      headers: {'access-control-allow-origin': '*'},
    })
  })

  const startedAt = Date.now()
  const result = await waitForHtmx(page, () =>
    page.evaluate(() => {
      void fetch('https://example.test/htmx', {
        headers: {'HX-Request': 'true'},
      })
      return 'started'
    }),
  )

  assert.equal(result, 'started')
  assert.ok(Date.now() - startedAt >= 100)
})

test('supports actions that make no htmx request', async ({page}) => {
  const result = await waitForHtmx(page, async () => 'no request')

  assert.equal(result, 'no request')
})
