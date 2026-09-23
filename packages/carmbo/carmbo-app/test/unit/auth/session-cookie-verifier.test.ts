import assert from 'node:assert/strict'
import {setTimeout} from 'node:timers/promises'
import {describe, test} from 'node:test'
import {createSessionCookieVerifier} from '../../../src/domain/auth/session-cookie-verifier.ts'

function createAuth() {
  const calls: Array<{sessionCookie: string; checkRevoked: boolean | undefined}> = []
  const revokedCookies = new Set<string>()

  return {
    calls,
    revokedCookies,
    async verifySessionCookie(sessionCookie: string, checkRevoked?: boolean) {
      calls.push({sessionCookie, checkRevoked})
      if (checkRevoked && revokedCookies.has(sessionCookie)) {
        throw new Error('Session cookie revoked')
      }

      const [uid, email] = sessionCookie.split(':')
      return {uid, email}
    },
  }
}

describe('session cookie verifier', () => {
  test('checks revocation once per UID during the TTL', async () => {
    const auth = createAuth()
    const verifier = createSessionCookieVerifier(auth)

    assert.deepEqual(await verifier.verify('user-1:user@example.com'), {
      uid: 'user-1',
      email: 'user@example.com',
    })
    assert.deepEqual(await verifier.verify('user-1:user@example.com'), {
      uid: 'user-1',
      email: 'user@example.com',
    })

    assert.deepEqual(auth.calls, [
      {sessionCookie: 'user-1:user@example.com', checkRevoked: false},
      {sessionCookie: 'user-1:user@example.com', checkRevoked: true},
      {sessionCookie: 'user-1:user@example.com', checkRevoked: false},
    ])
  })

  test('checks revocation again after the TTL expires', async () => {
    const auth = createAuth()
    const verifier = createSessionCookieVerifier(auth, {ttl: 1})

    await verifier.verify('user-1:user@example.com')
    await setTimeout(5)
    await verifier.verify('user-1:user@example.com')

    assert.equal(auth.calls.filter(({checkRevoked}) => checkRevoked).length, 2)
  })

  test('does not cache a failed revocation check', async () => {
    const auth = createAuth()
    const verifier = createSessionCookieVerifier(auth)
    auth.revokedCookies.add('user-1:user@example.com')

    assert.equal(await verifier.verify('user-1:user@example.com'), undefined)
    assert.equal(await verifier.verify('user-1:user@example.com'), undefined)
    assert.equal(auth.calls.filter(({checkRevoked}) => checkRevoked).length, 2)
  })

  test('coalesces concurrent revocation checks for the same UID', async () => {
    const auth = createAuth()
    const verifier = createSessionCookieVerifier(auth)

    await Promise.all([
      verifier.verify('user-1:user@example.com'),
      verifier.verify('user-1:user@example.com'),
    ])

    assert.equal(auth.calls.filter(({checkRevoked}) => checkRevoked).length, 1)
  })

  test('checks revocation again after invalidation', async () => {
    const auth = createAuth()
    const verifier = createSessionCookieVerifier(auth)

    await verifier.verify('user-1:user@example.com')
    verifier.invalidate('user-1')
    await verifier.verify('user-1:user@example.com')

    assert.equal(auth.calls.filter(({checkRevoked}) => checkRevoked).length, 2)
  })
})
