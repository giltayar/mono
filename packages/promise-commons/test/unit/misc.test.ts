import {it, describe} from 'node:test'
import assert from 'node:assert/strict'

import {failAfter, presult, unwrapPresult, delay} from '../../src/promise-commons.ts'

describe('functional-commons', function () {
  describe('failAfter', () => {
    it('should work', async () => {
      const start = Date.now()
      let end = Date.now()

      await failAfter(40, () => new Error('lalala')).catch((err) => {
        assert.equal(err.message, 'lalala')
        end = Date.now()
      })

      assert.notEqual(end, undefined)
      assert.ok(end - start > 39)
    })
  })

  describe('presult', () => {
    it('should return an error when the promise is rejected', async () => {
      const err = new Error('hi there')
      assert.deepEqual(await presult(Promise.reject(err)), [err, undefined])
    })

    it('should return the value as second array item when the promise is resolved', async () => {
      assert.deepEqual(await presult(Promise.resolve(42)), [undefined, 42])
    })
  })
  describe('unwrapPresult', () => {
    it('should unwrap a resolved presult to the original value', async () => {
      assert.equal(await unwrapPresult(presult(delay(1).then(() => 42))), 42)
    })

    it('should unwrap a rejected presult to the original value', async () => {
      const error = new Error('Ouch')

      assert.rejects(unwrapPresult(presult(delay(1).then(() => Promise.reject(error)))), error)
    })
  })

  describe('delay', () => {
    it('should delay execution', async () => {
      const start = Date.now()

      assert.equal(await delay(100), undefined)

      assert.ok(Date.now() - start >= 100)
    })
  })
})
