import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
  PASSWORD_MIN_LENGTH,
  requestPasswordReset,
  validateRegistration,
} from '../../../src/domain/login/model.ts'
import type {AuthError, FirebaseAuth} from '../../../src/services/firebase-auth.ts'

const VALID = {
  email: 'someone@example.com',
  password: 'a-long-enough-password',
  confirmPassword: 'a-long-enough-password',
}

describe('validateRegistration', () => {
  it('should accept a well-formed registration', () => {
    assert.equal(validateRegistration(VALID), undefined)
  })

  it('should ignore whitespace around the email', () => {
    assert.equal(validateRegistration({...VALID, email: '  someone@example.com  '}), undefined)
  })

  it('should reject something that is not an email', () => {
    for (const email of ['', 'someone', 'someone@', '@example.com', 'some one@example.com']) {
      assert.equal(validateRegistration({...VALID, email}), 'invalid-email')
    }
  })

  it('should reject a password shorter than the minimum', () => {
    const password = 'x'.repeat(PASSWORD_MIN_LENGTH - 1)

    assert.equal(
      validateRegistration({...VALID, password, confirmPassword: password}),
      'weak-password',
    )
  })

  it('should accept a password of exactly the minimum length', () => {
    const password = 'x'.repeat(PASSWORD_MIN_LENGTH)

    assert.equal(validateRegistration({...VALID, password, confirmPassword: password}), undefined)
  })

  it('should reject two passwords that differ', () => {
    assert.equal(
      validateRegistration({...VALID, confirmPassword: 'something-else-entirely'}),
      'passwords-do-not-match',
    )
  })

  it('should complain about the email before the password', () => {
    assert.equal(
      validateRegistration({email: 'not-an-email', password: 'x', confirmPassword: 'y'}),
      'invalid-email',
    )
  })
})

describe('requestPasswordReset', () => {
  /** Only `sendPasswordResetEmail` is ever reached, so nothing else needs to exist */
  function authThatAnswers(answer: undefined | {error: AuthError}) {
    const emails: string[] = []

    const auth = {
      async sendPasswordResetEmail(email: string) {
        emails.push(email)

        return answer
      },
    } as FirebaseAuth

    return {auth, emails}
  }

  it('should ask firebase for a reset mail', async () => {
    const {auth, emails} = authThatAnswers(undefined)

    assert.deepEqual(await requestPasswordReset(auth, '  someone@example.com  '), {sent: true})
    assert.deepEqual(emails, ['someone@example.com'])
  })

  it('should reject something that is not an email, without asking firebase', async () => {
    const {auth, emails} = authThatAnswers(undefined)

    assert.deepEqual(await requestPasswordReset(auth, 'someone'), {error: 'invalid-email'})
    assert.deepEqual(emails, [])
  })

  // an unknown address is rejected by firebase with the same code as a wrong password, and must be
  // answered exactly like an address that does have an account
  it('should say it was sent for an email firebase does not know', async () => {
    const {auth} = authThatAnswers({error: 'invalid-credentials'})

    assert.deepEqual(await requestPasswordReset(auth, 'nobody@example.com'), {sent: true})
  })

  it('should report a failure that has nothing to do with the address', async () => {
    for (const [error, expected] of [
      ['too-many-attempts', 'too-many-attempts'],
      ['unavailable', 'unavailable'],
    ] as const) {
      const {auth} = authThatAnswers({error})

      assert.deepEqual(await requestPasswordReset(auth, 'someone@example.com'), {error: expected})
    }
  })
})
