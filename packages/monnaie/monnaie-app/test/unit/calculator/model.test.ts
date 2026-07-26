import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {calculate} from '../../../src/domain/calculator/model.ts'

describe('calculate', () => {
  it('should return the number itself for a single number', () => {
    assert.deepStrictEqual(calculate('42'), {value: '42'})
    assert.deepStrictEqual(calculate('0'), {value: '0'})
    assert.deepStrictEqual(calculate('-7'), {value: '-7'})
    assert.deepStrictEqual(calculate('3.5'), {value: '3.5'})
  })

  it('should apply the four standard operators', () => {
    assert.deepStrictEqual(calculate('12 + 30'), {value: '42'})
    assert.deepStrictEqual(calculate('50 - 8'), {value: '42'})
    assert.deepStrictEqual(calculate('6 * 7'), {value: '42'})
    assert.deepStrictEqual(calculate('84 / 2'), {value: '42'})
  })

  it('should support negative and decimal operands', () => {
    assert.deepStrictEqual(calculate('-2 + 44'), {value: '42'})
    assert.deepStrictEqual(calculate('1 - -1'), {value: '2'})
    assert.deepStrictEqual(calculate('1.5 * 2'), {value: '3'})
  })

  it('should ignore surrounding and inner whitespace', () => {
    assert.deepStrictEqual(calculate('   12+30   '), {value: '42'})
    assert.deepStrictEqual(calculate('12   +   30'), {value: '42'})
  })

  it('should return an error for an empty expression', () => {
    assert.deepStrictEqual(calculate(''), {error: 'empty'})
    assert.deepStrictEqual(calculate('   '), {error: 'empty'})
  })

  it('should return an error for more than one operator', () => {
    assert.deepStrictEqual(calculate('1 + 2 * 3'), {error: 'invalid'})
    assert.deepStrictEqual(calculate('1 +* 3'), {error: 'invalid'})
  })

  it('should return an error for a division by zero', () => {
    assert.deepStrictEqual(calculate('1 / 0'), {error: 'invalid'})
  })

  it('should return an error for anything that is not a plain calculation', () => {
    assert.deepStrictEqual(calculate('(1 + 2)'), {error: 'invalid'})
    assert.deepStrictEqual(calculate('process.exit(1)'), {error: 'invalid'})
    assert.deepStrictEqual(calculate('1 + 2; console.log("hi")'), {error: 'invalid'})
    assert.deepStrictEqual(calculate('1e3'), {error: 'invalid'})
    assert.deepStrictEqual(calculate('12 %  30'), {error: 'invalid'})
    assert.deepStrictEqual(calculate('12 +'), {error: 'invalid'})
  })
})
