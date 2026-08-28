import assert from 'node:assert/strict'
import test from 'node:test'
import {SessionRevocationCache} from '../../../src/services/session-revocation-cache.ts'

test('remembers a checked session until the maximum age', () => {
  let now = 1_000
  const cache = new SessionRevocationCache(60 * 60 * 1000, 10, () => now)

  cache.add('session-cookie')

  assert.equal(cache.has('session-cookie'), true)

  now += 60 * 60 * 1000

  assert.equal(cache.has('session-cookie'), false)
})

test('does not share a revocation check between cookies', () => {
  const cache = new SessionRevocationCache(60 * 60 * 1000, 10, () => 1_000)

  cache.add('new-session-for-user')

  assert.equal(cache.has('old-session-for-same-user'), false)
})

test('evicts the least recently used session when full', () => {
  const cache = new SessionRevocationCache(60 * 60 * 1000, 2, () => 1_000)

  cache.add('first-session')
  cache.add('second-session')
  assert.equal(cache.has('first-session'), true)

  cache.add('third-session')

  assert.equal(cache.has('first-session'), true)
  assert.equal(cache.has('second-session'), false)
  assert.equal(cache.has('third-session'), true)
})
