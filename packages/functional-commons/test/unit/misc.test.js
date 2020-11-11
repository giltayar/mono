'use strict'
const {describe, it} = require('mocha')
const {expect} = require('chai')

const {
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
} = require('../..')

describe('functional-commons', function () {
  describe('range', () => {
    it('should return an empty array if from === to', () => {
      expect(range(4, 4)).to.eql([])
    })
    it('should return an empty array if from > to', () => {
      expect(range(5, 4)).to.eql([])
    })
    it('should return the numbers if from < to', () => {
      expect(range(4, 7)).to.eql([4, 5, 6])
      expect(range(0, 4)).to.eql([0, 1, 2, 3])
    })
    it('should step correctly', () => {
      expect(range(4, 8, 2)).to.eql([4, 6])
      expect(range(0, 13, 3)).to.eql([0, 3, 6, 9, 12])
      expect(range(7, 8, 3)).to.eql([7])
    })
  })

  describe('sum', () => {
    it('should return 0 for an empty array', () => {
      expect(sum([])).to.equal(0)
    })
    it('should return number for a 1-length array', () => {
      expect(sum([42])).to.equal(42)
    })
    it('should return sum for an array', () => {
      expect(sum([7, 9, 0, -1, 3])).to.equal(18)
    })
  })

  describe('throw_', () => {
    it('should throw an error', async () => {
      let value
      const thrownErr = new Error('hi')
      try {
        value = throw_(thrownErr)
      } catch (err) {
        expect(value).to.be.undefined
        expect(err).to.equal(thrownErr)
      }
    })
  })

  describe('mapObject', () => {
    it('should work with identity', () => {
      expect(mapObject({a: 1, b: 2}, (key, value) => [key, value])).to.eql({a: 1, b: 2})
    })

    it('should map keys', () => {
      expect(mapObject({a: 1, b: 2}, (key, value) => [key + '1', value])).to.eql({a1: 1, b1: 2})
    })

    it('should map values', () => {
      expect(mapObject({a: 1, b: 2}, (key, value) => [key, value + 1])).to.eql({a: 2, b: 3})
    })

    it('should map both', () => {
      expect(mapObject({a: 1, b: 2}, (key, value) => [key + '1', value + 1])).to.eql({a1: 2, b1: 3})
    })
  })

  describe('mapValues', () => {
    it('should work with identity', () => {
      expect(mapValues({a: 1, b: 2}, (value) => value)).to.eql({a: 1, b: 2})
    })

    it('should map values', () => {
      expect(mapValues({a: 1, b: 2}, (value) => value + 1)).to.eql({a: 2, b: 3})
    })
  })

  describe('mapKeys', () => {
    it('should work with identity', () => {
      expect(mapKeys({a: 1, b: 2}, (value) => value)).to.eql({a: 1, b: 2})
    })

    it('should map keys', () => {
      expect(mapKeys({a: 1, b: 2}, (value) => value + 'x')).to.eql({ax: 1, bx: 2})
    })
  })

  describe('makeError', () => {
    it('should create an Error if passed a string', async () => {
      const err = makeError('foo')

      expect(err).to.be.instanceof(Error)
      expect(err.message).to.equal('foo')
    })

    it('should set propties of error according to properties parameter', async () => {
      const err = makeError('lalala', {code: 4, lode: 5})

      expect(err).to.be.instanceof(Error)
      expect(err.message).to.equal('lalala')
      expect(err.code).to.equal(4)
      expect(err.lode).to.equal(5)
    })
  })

  describe('zip', () => {
    it('should return zip with two arrays of equal length', () => {
      expect(zip([1, 2, 3], [4, 5, 6])).to.eql([
        [1, 4],
        [2, 5],
        [3, 6],
      ])
    })

    it('should return zip with two arrays of unequal length', () => {
      expect(zip([1, 2, 3], [4, 5])).to.eql([
        [1, 4],
        [2, 5],
        [3, undefined],
      ])
      expect(zip([1, 2], [3, 4, 5])).to.eql([
        [1, 3],
        [2, 4],
        [undefined, 5],
      ])
    })
  })

  describe('minus', () => {
    it('should return the difference between two arrays', () => {
      expect(minus(['a', 'b'], ['b'])).to.eql(['a'])
    })
    it('should return an empty array if they are the same', () => {
      expect(minus(['a', 'b'], ['a', 'b'])).to.eql([])
    })
    it('should return the first array if the second is empty', () => {
      expect(minus(['a', 'b'])).to.eql(['a', 'b'])
    })
    it('should return an empty array if the first is empty', () => {
      expect(minus([], ['a', 'b'])).to.eql([])
    })
  })

  describe('diff', () => {
    it('should return the difference between two arrays', () => {
      expect(diff(['a', 'b'], ['b'])).to.eql(['a'])
      expect(diff(['b'], ['a', 'b'])).to.eql(['a'])
    })
    it('should return the first array if the second is empty', () => {
      expect(diff(['a', 'b'])).to.eql(['a', 'b'])
    })
    it('should return the second array if the first is empty', () => {
      expect(diff([], ['a', 'b'])).to.eql(['a', 'b'])
    })
    it('should return an empty array if they are the same', () => {
      expect(diff(['a', 'b'], ['a', 'b'])).to.eql([])
    })
  })

  describe('filterMap functions', () => {
    it('filterKeys should filter keys', () => {
      expect(filterKeys({a: 4, b: 5, c: 6}, (k) => k === 'a' || k === 'c')).to.eql({a: 4, c: 6})
    })
    it('filterValues should filter values', () => {
      expect(filterValues({a: 4, b: 5, c: 6}, (v) => v === 4 || v === 5)).to.eql({a: 4, b: 5})
    })
    it('filterEntries should filter entries', () => {
      expect(filterEntries({a: 4, b: 5, c: 6}, (k, v) => k === 'a' && v === 4)).to.eql({a: 4})
    })
  })

  describe('pick', () => {
    it('should return empty object if no objectKeys', () => {
      expect(pick({a: 4, b: 5}, [])).to.eql({})
    })

    it('should return filtered object on one entry in objectKeys', () => {
      expect(pick({a: 4, b: 5}, ['b'])).to.eql({b: 5})
    })

    it('should return filtered object on two entries in objectKeys', () => {
      expect(pick({a: 4, b: 5, c: 6}, ['b', 'a'])).to.eql({b: 5, a: 4})
    })

    it('should deal with objectKeys with non-existing key', () => {
      //@ts-expect-error
      expect(pick({a: 4, b: 5, c: 6}, ['b', 'd'])).to.eql({b: 5})
    })

    it('should deal correctly with undefined', () => {
      expect(pick({a: 4, b: undefined, c: 6}, ['b'])).to.eql({b: undefined})
    })

    it('should deal with empty object', () => {
      //@ts-expect-error
      expect(pick({}, ['b'])).to.eql({})
      //@ts-expect-error
      expect(pick(undefined, ['b'])).to.eql(undefined)
      //@ts-expect-error
      expect(pick(null, ['b'])).to.eql(null)
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
      expect(grouped).to.deep.equal({
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

    it('group will return an undefined group when grouped by a prop that is not there', () => {
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

      //@ts-expect-error
      const grouped = group('foo', items)
      expect(grouped).to.deep.equal({
        undefined: items,
      })
    })

    it('group will return an empty object on an empty array', () => {
      expect(group('foo', [])).to.eql({})
    })
  })
})
