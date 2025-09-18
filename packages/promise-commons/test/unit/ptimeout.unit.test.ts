import {it, describe} from 'node:test'
import assert from 'node:assert/strict'

import {
  ptimeoutWithValue,
  ptimeoutWithError,
  ptimeoutWithFunction,
  presult,
  delay,
} from '../../src/promise-commons.ts'

describe('ptimeout*', function () {
  describe('ptimeoutWithFunction', () => {
    it('should return promise value if less than timeout', async () => {
      assert.equal(
        await ptimeoutWithFunction(Promise.resolve(32), 2000, () => Promise.resolve(66)),
        32,
      )
    })

    it('should not call timeout function if less', async () => {
      let timeoutFunctionCalled = false
      await ptimeoutWithFunction(
        Promise.resolve(32),
        200,
        () => ((timeoutFunctionCalled = true), Promise.resolve()),
      )

      await delay(400)

      assert.equal(timeoutFunctionCalled, false)
    })

    it('should return timeout value if more than timeout', async () => {
      const start = Date.now()
      assert.equal(await ptimeoutWithFunction(delay(2000), 20, () => Promise.resolve(66)), 66)

      assert.ok(Date.now() - start < 2000)
    })

    it('should return promise value if less than timeout and not abort function', async () => {
      assert.equal(
        await ptimeoutWithFunction(
          (abortSignal) => (abortSignal.aborted ? Promise.resolve(undefined) : Promise.resolve(32)),
          2000,
          () => Promise.resolve(66),
        ),
        32,
      )
    })

    it('should return timeout value if more than timeout and abort function', async () => {
      const start = Date.now()
      let aborted = false
      assert.equal(
        await ptimeoutWithFunction(
          (abortSignal) => delay(200).then(() => (aborted = abortSignal.aborted)),
          20,
          () => Promise.resolve(66),
        ),
        66,
      )

      assert.ok(Date.now() - start < 200)
      await delay(400)

      assert.equal(aborted, true)
    })
  })

  describe('ptimeoutWithValue', () => {
    it('should return promise value if less than timeout', async () => {
      assert.equal(await ptimeoutWithValue(Promise.resolve(32), 2000, 66), 32)
    })

    it('should return timeout value if more than timeout', async () => {
      const start = Date.now()
      assert.equal(await ptimeoutWithValue(delay(2000), 20, 66), 66)

      assert.ok(Date.now() - start < 2000)
    })

    it('should return promise value if less than timeout and not abort function', async () => {
      assert.equal(
        await ptimeoutWithValue(
          (abortSignal) => (abortSignal.aborted ? Promise.resolve(undefined) : Promise.resolve(32)),
          2000,
          Promise.resolve(66),
        ),
        32,
      )
    })

    it('should return timeout value if more than timeout and abort function', async () => {
      const start = Date.now()
      let aborted = false
      assert.equal(
        await ptimeoutWithValue(
          (abortSignal) => delay(200).then(() => (aborted = abortSignal.aborted)),
          20,
          66,
        ),
        66,
      )

      assert.ok(Date.now() - start < 200)
      await delay(400)

      assert.equal(aborted, true)
    })
  })

  describe('ptimeoutWithError', () => {
    it('should return promise value if less than timeout', async () => {
      assert.equal(await ptimeoutWithError(Promise.resolve(32), 2000, new Error()), 32)
    })

    it('should return timeout error if more than timeout', async () => {
      const start = Date.now()
      assert.equal((await presult(ptimeoutWithError(delay(2000), 20, 66)))[0], 66)

      assert.ok(Date.now() - start < 2000)
    })

    it('should return promise value if less than timeout and not abort function', async () => {
      assert.equal(
        await ptimeoutWithError(
          (abortSignal) => (abortSignal.aborted ? Promise.resolve(undefined) : Promise.resolve(32)),
          2000,
          new Error(),
        ),
        32,
      )
    })

    it('should return timeout value if more than timeout and abort function', async () => {
      const start = Date.now()
      let aborted = false
      assert.deepEqual(
        await presult(
          ptimeoutWithError(
            (abortSignal) => delay(200).then(() => (aborted = abortSignal.aborted)),
            20,
            66,
          ),
        ),
        [66, undefined],
      )

      assert.ok(Date.now() - start < 200)
      await delay(400)

      assert.equal(aborted, true)
    })
  })
})
