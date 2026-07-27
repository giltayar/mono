import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {PASSWORD_MIN_LENGTH, validateRegistration} from '../../../src/domain/login/model.ts'

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
