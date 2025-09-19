import {describe, it} from 'node:test'
import assert from 'node:assert'

import {
  range,
  sum,
  throw_,
  mapObject,
  mapValues,
  mapKeys,
  filterKeys,
  filterValues,
  filterEntries,
  makeError,
  zip,
  pick,
  minus,
  diff,
  group,
  clone,
  sresult,
} from '../../src/functional-commons.ts'

describe('functional-commons', function () {
  describe('range', () => {
    it('should return an empty array if from === to', () => {
      assert.deepStrictEqual(range(4, 4), [])
    })
    it('should return an empty array if from > to', () => {
      assert.deepStrictEqual(range(5, 4), [])
    })
    it('should return the numbers if from < to', () => {
      assert.deepStrictEqual(range(4, 7), [4, 5, 6])
      assert.deepStrictEqual(range(0, 4), [0, 1, 2, 3])
    })
    it('should step correctly', () => {
      assert.deepStrictEqual(range(4, 8, 2), [4, 6])
      assert.deepStrictEqual(range(0, 13, 3), [0, 3, 6, 9, 12])
      assert.deepStrictEqual(range(7, 8, 3), [7])
    })
  })

  describe('sum', () => {
    it('should return 0 for an empty array', () => {
      assert.strictEqual(sum([]), 0)
    })
    it('should return number for a 1-length array', () => {
      assert.strictEqual(sum([42]), 42)
    })
    it('should return sum for an array', () => {
      assert.strictEqual(sum([7, 9, 0, -1, 3]), 18)
    })
  })

  describe('throw_', () => {
    it('should throw an error', async () => {
      let value
      const thrownErr = new Error('hi')
      try {
        value = throw_(thrownErr)
      } catch (err) {
        assert.strictEqual(value, undefined)
        assert.strictEqual(err, thrownErr)
      }
    })
  })

  describe('mapObject', () => {
    it('should work with identity', () => {
      assert.deepStrictEqual(
        mapObject({a: 1, b: 2}, (key, value) => [key, value]),
        {a: 1, b: 2},
      )
    })

    it('should map keys', () => {
      assert.deepStrictEqual(
        mapObject({a: 1, b: 2}, (key, value) => [key + '1', value]),
        {a1: 1, b1: 2},
      )
    })

    it('should map values', () => {
      assert.deepStrictEqual(
        mapObject({a: 1, b: 2}, (key, value) => [key, value + 1]),
        {a: 2, b: 3},
      )
    })

    it('should map both', () => {
      assert.deepStrictEqual(
        mapObject({a: 1, b: 2}, (key, value) => [key + '1', value + 1]),
        {a1: 2, b1: 3},
      )
    })
  })

  describe('mapValues', () => {
    it('should work with identity', () => {
      assert.deepStrictEqual(
        mapValues({a: 1, b: 2}, (value) => value),
        {a: 1, b: 2},
      )
    })

    it('should map values', () => {
      assert.deepStrictEqual(
        mapValues({a: 1, b: 2}, (value) => value + 1),
        {a: 2, b: 3},
      )
    })
  })

  describe('mapKeys', () => {
    it('should work with identity', () => {
      assert.deepStrictEqual(
        mapKeys({a: 1, b: 2}, (value) => value),
        {a: 1, b: 2},
      )
    })

    it('should map keys', () => {
      assert.deepStrictEqual(
        mapKeys({a: 1, b: 2}, (value) => value + 'x'),
        {ax: 1, bx: 2},
      )
    })
  })

  describe('makeError', () => {
    it('should create an Error if passed a string', async () => {
      const err = makeError('foo')

      assert.ok(err instanceof Error)
      assert.strictEqual(err.message, 'foo')
    })

    it('should set propties of error according to properties parameter', async () => {
      const err = makeError('lalala', {code: 4, lode: 5})

      assert.ok(err instanceof Error)
      assert.strictEqual(err.message, 'lalala')
      assert.strictEqual((err as any).code, 4)
      assert.strictEqual((err as any).lode, 5)
    })
  })

  describe('zip', () => {
    it('should return zip with two arrays of equal length', () => {
      assert.deepStrictEqual(zip([1, 2, 3], [4, 5, 6]), [
        [1, 4],
        [2, 5],
        [3, 6],
      ])
    })

    it('should return zip with two arrays of unequal length', () => {
      assert.deepStrictEqual(zip([1, 2, 3], [4, 5]), [
        [1, 4],
        [2, 5],
        [3, undefined],
      ])
      assert.deepStrictEqual(zip([1, 2], [3, 4, 5]), [
        [1, 3],
        [2, 4],
        [undefined, 5],
      ])
    })

    it('should return zip with two arrays of unequal length', () => {
      assert.deepStrictEqual(zip([1, 2, 3], [4, 5]), [
        [1, 4],
        [2, 5],
        [3, undefined],
      ])
      assert.deepStrictEqual(zip([1, 2], [3, 4, 5]), [
        [1, 3],
        [2, 4],
        [undefined, 5],
      ])
    })

    it('should return zip with two arrays of unequal length - duplicate end', () => {
      assert.deepStrictEqual(zip([1, 2, 3], [4, 5]), [
        [1, 4],
        [2, 5],
        [3, undefined],
      ])
    })
  })

  describe('minus', () => {
    it('should return the difference between two arrays', () => {
      assert.deepStrictEqual(minus(['a', 'b'], ['b']), ['a'])
    })
    it('should return an empty array if they are the same', () => {
      assert.deepStrictEqual(minus(['a', 'b'], ['a', 'b']), [])
    })
    it('should return the first array if the second is empty', () => {
      assert.deepStrictEqual(minus(['a', 'b']), ['a', 'b'])
    })
    it('should return an empty array if the first is empty', () => {
      assert.deepStrictEqual(minus([], ['a', 'b']), [])
    })
  })

  describe('diff', () => {
    it('should return the difference between two arrays', () => {
      assert.deepStrictEqual(diff(['a', 'b'], ['b']), ['a'])
      assert.deepStrictEqual(diff(['b'], ['a', 'b']), ['a'])
    })
    it('should return the first array if the second is empty', () => {
      assert.deepStrictEqual(diff(['a', 'b']), ['a', 'b'])
    })
    it('should return the second array if the first is empty', () => {
      assert.deepStrictEqual(diff([], ['a', 'b']), ['a', 'b'])
    })
    it('should return an empty array if they are the same', () => {
      assert.deepStrictEqual(diff(['a', 'b'], ['a', 'b']), [])
    })
  })

  describe('filterMap functions', () => {
    it('filterKeys should filter keys', () => {
      assert.deepStrictEqual(
        filterKeys({a: 4, b: 5, c: 6}, (k) => k === 'a' || k === 'c'),
        {a: 4, c: 6},
      )
    })
    it('filterValues should filter values', () => {
      assert.deepStrictEqual(
        filterValues({a: 4, b: 5, c: 6}, (v) => v === 4 || v === 5),
        {a: 4, b: 5},
      )
    })
    it('filterEntries should filter entries', () => {
      assert.deepStrictEqual(
        filterEntries({a: 4, b: 5, c: 6}, (k, v) => k === 'a' && v === 4),
        {a: 4},
      )
    })
  })

  describe('pick', () => {
    it('should return empty object if no objectKeys', () => {
      assert.deepStrictEqual(pick({a: 4, b: 5}, []), {})
    })

    it('should return filtered object on one entry in objectKeys', () => {
      assert.deepStrictEqual(pick({a: 4, b: 5}, ['b']), {b: 5})
    })

    it('should return filtered object on two entries in objectKeys', () => {
      assert.deepStrictEqual(pick({a: 4, b: 5, c: 6}, ['b', 'a']), {b: 5, a: 4})
    })

    it('should deal with objectKeys with non-existing key', () => {
      assert.deepStrictEqual(pick({a: 4, b: 5, c: 6}, ['b', 'd'] as any), {b: 5})
    })

    it('should deal correctly with undefined', () => {
      assert.deepStrictEqual(pick({a: 4, b: undefined, c: 6}, ['b']), {b: undefined})
    })

    it('should deal with empty object', () => {
      assert.deepStrictEqual(pick({} as any, ['b']), {})
      assert.deepStrictEqual(pick(undefined as any, ['b']), undefined)
      assert.deepStrictEqual(pick(null as any, ['b']), null)
    })
  })

  describe('group', () => {
    it('group will return an array as an object grouped by the prop requested', () => {
      const items = [
        {type: 'a', value: 120},
        {type: 'a', value: 140},
        {type: 'a', value: 1},
        {type: 'b', value: 4},
        {type: 'b', value: 3},
        {type: 'c', value: 1},
        {type: 'c', value: 2},
        {type: 'z', value: 55},
      ]

      const grouped = group('type', items)
      assert.deepStrictEqual(grouped, {
        a: [
          {type: 'a', value: 120},
          {type: 'a', value: 140},
          {type: 'a', value: 1},
        ],
        b: [
          {type: 'b', value: 4},
          {type: 'b', value: 3},
        ],
        c: [
          {type: 'c', value: 1},
          {type: 'c', value: 2},
        ],
        z: [{type: 'z', value: 55}],
      })
    })
  })

  describe('clone', () => {
    it('should clone primitives', () => {
      assert.strictEqual(clone(4), 4)
      assert.strictEqual(clone('foo'), 'foo')
      assert.strictEqual(clone(undefined), undefined)
      assert.strictEqual(clone(null), null)
    })

    it('should clone arrays', () => {
      assert.deepStrictEqual(clone([1, 2, 3]), [1, 2, 3])
      assert.notStrictEqual(clone([1, 2, 3]), [1, 2, 3])
    })

    it('should clone objects', () => {
      assert.deepStrictEqual(clone({a: 1, b: 2}), {a: 1, b: 2})
      assert.notStrictEqual(clone({a: 1, b: 2}), {a: 1, b: 2})
    })

    it('should clone nested structures', () => {
      const obj = {a: 1, b: {c: 2}}
      const clonedObj = clone(obj)

      assert.deepStrictEqual(clonedObj, obj)
      assert.notStrictEqual(clonedObj, obj)
      assert.notStrictEqual(clonedObj.b, obj.b)
    })
  })

  describe('sresult', () => {
    it('should return success result', () => {
      assert.deepStrictEqual(
        sresult(() => 42),
        [undefined, 42],
      )
    })

    it('should return failure result', () => {
      assert.deepStrictEqual(
        sresult(() => {
          throw 42
        }),
        [42, undefined],
      )
    })
  })
})
