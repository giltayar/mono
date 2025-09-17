import {setTimeout} from 'node:timers/promises'
import {describe, it} from 'node:test'
import assert from 'node:assert'

import {memo, memoAsync} from '../../src/functional-commons.ts'

describe('functional-commons (unit)', function () {
  describe('cacheFunctionSync', async () => {
    it('should cache on same key', async () => {
      const value = {
        a: {},
      }

      let called = 0
      const cache = memo((x: keyof typeof value) => ({value: value[x], called: ++called}))

      const v = cache('a')
      assert.strictEqual(v.value, value.a)
      assert.strictEqual(v.called, 1)

      const v2 = cache('a')
      assert.strictEqual(v2.value, value.a)
      assert.strictEqual(v2.called, 1)
    })

    it('should not cache on different key', async () => {
      const value = {
        a: {},
        b: {},
      }

      let called = 0
      const cache = memo((x: keyof typeof value) => ({value: value[x], called: ++called}))

      const v = cache('a')
      assert.strictEqual(v.value, value.a)
      assert.strictEqual(v.called, 1)

      const v2 = cache('b')
      assert.strictEqual(v2.value, value.b)
      assert.strictEqual(v2.called, 2)
    })

    it('should cache/not cache on same/different keys', async () => {
      const value = {
        ax: {},
        bx: {},
      }

      let called = 0
      const cache = memo((x1: string, x2: string) => ({
        value: (value as any)[x1 + x2],
        called: ++called,
      }))

      const v = cache('a', 'x')
      assert.strictEqual(v.value, value.ax)
      assert.strictEqual(v.called, 1)

      assert.strictEqual(cache('a', 'x').called, 1)

      const v2 = cache('b', 'x')
      assert.strictEqual(v2.value, value.bx)
      assert.strictEqual(v2.called, 2)

      assert.strictEqual(cache('b', 'x').called, 2)
    })

    it('should throw exception if passed an async function', async () => {
      const cache = memo(async (x: number) => x as any)

      assert.throws(() => cache(4))
    })

    it('should work like lazy evaluation if not passed any parameters', async () => {
      let value = 0
      const cache = memo(() => ++value)

      assert.strictEqual(cache(), 1)
      assert.strictEqual(cache(), 1)
    })
  })
  describe('cacheFunctionAsync', async () => {
    it('should cache on same key', async () => {
      const value = {
        a: {},
      }

      let called = 0
      const cache = memoAsync(async (x: keyof typeof value) => ({
        value: value[x],
        called: ++called,
      }))

      const v = await cache('a')
      assert.strictEqual(v.value, value.a)
      assert.strictEqual(v.called, 1)

      const v2 = await cache('a')
      assert.strictEqual(v2.value, value.a)
      assert.strictEqual(v2.called, 1)
    })

    it('should not cache on different key', async () => {
      const value = {
        a: {},
        b: {},
      }

      let called = 0
      const cache = memoAsync(async (x: keyof typeof value) => ({
        value: value[x],
        called: ++called,
      }))

      const v = await cache('a')
      assert.strictEqual(v.value, value.a)
      assert.strictEqual(v.called, 1)

      const v2 = await cache('b')
      assert.strictEqual(v2.value, value.b)
      assert.strictEqual(v2.called, 2)
    })

    it('should cache/not cache on same/different keys', async () => {
      const value = {
        ax: {},
        bx: {},
      }

      let called = 0
      const cache = memoAsync(async (x1: string, x2: string) => ({
        value: (value as any)[x1 + x2],
        called: ++called,
      }))

      const v = await cache('a', 'x')
      assert.strictEqual(v.value, value.ax)
      assert.strictEqual(v.called, 1)

      assert.strictEqual((await cache('a', 'x')).called, 1)

      const v2 = await cache('b', 'x')
      assert.strictEqual(v2.value, value.bx)
      assert.strictEqual(v2.called, 2)

      assert.strictEqual((await cache('b', 'x')).called, 2)
    })

    it('should work like lazy evaluation if not passed any parameters', async () => {
      let value = 0
      const cache = memoAsync(async () => ++value)

      assert.strictEqual(await cache(), 1)
      assert.strictEqual(await cache(), 1)
    })

    it('should not expire if expire time not done', async () => {
      let value = 0
      const cache = memoAsync(async () => ++value, {expireAfterMs: 10000})

      assert.strictEqual(await cache(), 1)
      assert.strictEqual(await cache(), 1)
    })

    it('should expire if expire time done', async () => {
      let value = 0
      const cache = memoAsync(async () => ++value, {expireAfterMs: 1})

      assert.strictEqual(await cache(), 1)
      await setTimeout(5)
      assert.strictEqual(await cache(), 2)
    })
  })
})
