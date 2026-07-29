import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
  DESCRIPTION_MAX_LENGTH,
  validateExpense,
  type ExpenseInput,
} from '../../../src/domain/expenses/model.ts'

describe('validateExpense', () => {
  const valid: ExpenseInput = {description: 'Coffee', amount: '12.50', categoryId: '1'}

  it('should accept an expense and trim its description', () => {
    assert.deepStrictEqual(validateExpense({...valid, description: '  Coffee  '}), {
      expense: {description: 'Coffee', amount: 12.5, categoryId: 1},
    })
  })

  it('should accept an amount with no decimals', () => {
    assert.deepStrictEqual(validateExpense({...valid, amount: '6'}), {
      expense: {description: 'Coffee', amount: 6, categoryId: 1},
    })
  })

  it('should refuse a description that is only whitespace', () => {
    assert.deepStrictEqual(validateExpense({...valid, description: '   '}), {
      error: 'empty-description',
    })
  })

  it('should refuse a description longer than the limit', () => {
    assert.deepStrictEqual(
      validateExpense({...valid, description: 'x'.repeat(DESCRIPTION_MAX_LENGTH + 1)}),
      {error: 'description-too-long'},
    )
  })

  it('should accept a description exactly at the limit', () => {
    assert.ok(
      'expense' in validateExpense({...valid, description: 'x'.repeat(DESCRIPTION_MAX_LENGTH)}),
    )
  })

  for (const amount of ['', '   ', 'twelve', '12,50', '12.505', '-3', '0', '1e3', 'Infinity']) {
    it(`should refuse the amount ${JSON.stringify(amount)}`, () => {
      assert.deepStrictEqual(validateExpense({...valid, amount}), {error: 'invalid-amount'})
    })
  }

  it('should refuse an amount larger than the column can hold', () => {
    assert.deepStrictEqual(validateExpense({...valid, amount: '99999999999'}), {
      error: 'invalid-amount',
    })
  })

  for (const categoryId of ['', '0', '99', 'food', '1.5']) {
    it(`should refuse the category ${JSON.stringify(categoryId)}`, () => {
      assert.deepStrictEqual(validateExpense({...valid, categoryId}), {error: 'invalid-category'})
    })
  }

  it('should complain about the description before the amount', () => {
    assert.deepStrictEqual(validateExpense({description: '', amount: 'nope', categoryId: '99'}), {
      error: 'empty-description',
    })
  })
})
