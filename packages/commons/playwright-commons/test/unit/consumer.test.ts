import assert from 'node:assert/strict'
import test from 'node:test'
import * as playwrightCommons from '@giltayar/playwright-commons'

test('publishes the intended package API', () => {
  assert.deepEqual(Object.keys(playwrightCommons), ['waitForHtmx'])
})
