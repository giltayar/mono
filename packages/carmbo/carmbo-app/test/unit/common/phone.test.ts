import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {normalizePhoneNumber} from '../../../src/commons/phone.ts'

describe('normalizePhoneNumber', () => {
  describe('international format with +', () => {
    it('should keep number starting with +', () => {
      assert.equal(normalizePhoneNumber('+972501234567'), '0501234567')
    })

    it('should keep + format with spaces and dashes', () => {
      assert.equal(normalizePhoneNumber('+972-50-123-4567'), '0501234567')
    })

    it('should keep + format with any country code', () => {
      assert.equal(normalizePhoneNumber('+1-555-123-4567'), '+15551234567')
    })
  })

  describe('972 prefix with leading 0', () => {
    it('should remove leading 0 after 972', () => {
      assert.equal(normalizePhoneNumber('972050-123-4567'), '0501234567')
    })

    it('should handle 972 with 0 and no separators', () => {
      assert.equal(normalizePhoneNumber('972501234567'), '0501234567')
    })
  })

  describe('972 prefix without leading 0', () => {
    it('should add leading 0 when 972 is followed by non-0 digit', () => {
      assert.equal(normalizePhoneNumber('97250-123-4567'), '0501234567')
    })

    it('should add leading 0 for 972 without 0', () => {
      assert.equal(normalizePhoneNumber('972501234567'), '0501234567')
    })
  })

  describe('numbers starting with 0', () => {
    it('should keep numbers starting with 0', () => {
      assert.equal(normalizePhoneNumber('0501234567'), '0501234567')
    })

    it('should keep 0 prefix with formatting', () => {
      assert.equal(normalizePhoneNumber('050-123-4567'), '0501234567')
    })

    it('should keep 0 prefix with spaces and dashes', () => {
      assert.equal(normalizePhoneNumber('050 123 4567'), '0501234567')
    })
  })

  describe('9-digit numbers without prefix', () => {
    it('should add 0 to 9-digit number', () => {
      assert.equal(normalizePhoneNumber('501234567'), '0501234567')
    })

    it('should add 0 to 9-digit number with formatting', () => {
      assert.equal(normalizePhoneNumber('50-123-4567'), '0501234567')
    })
  })

  describe('edge cases and invalid inputs', () => {
    it('should handle empty string', () => {
      assert.equal(normalizePhoneNumber(''), '')
    })

    it('should remove all non-numeric characters except +', () => {
      assert.equal(normalizePhoneNumber('(050) 123-4567'), '0501234567')
    })

    it('should handle numbers with letters', () => {
      assert.equal(normalizePhoneNumber('050-ABC-4567'), '0504567')
    })

    it('should return as-is for numbers not matching patterns', () => {
      assert.equal(normalizePhoneNumber('12345'), '12345')
    })

    it('should handle 8-digit number', () => {
      assert.equal(normalizePhoneNumber('12345678'), '12345678')
    })

    it('should handle 10-digit number not starting with special patterns', () => {
      assert.equal(normalizePhoneNumber('1234567890'), '1234567890')
    })
  })

  describe('special formatting characters', () => {
    it('should remove spaces', () => {
      assert.equal(normalizePhoneNumber('050 123 4567'), '0501234567')
    })

    it('should remove dashes', () => {
      assert.equal(normalizePhoneNumber('050-123-4567'), '0501234567')
    })

    it('should remove parentheses', () => {
      assert.equal(normalizePhoneNumber('(050)1234567'), '0501234567')
    })

    it('should remove mixed formatting', () => {
      assert.equal(normalizePhoneNumber('+972 (50) 123-4567'), '0501234567')
    })
  })
})
