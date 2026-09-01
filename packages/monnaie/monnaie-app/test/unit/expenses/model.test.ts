import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
  DESCRIPTION_MAX_LENGTH,
  parseCategoryFilter,
  parseRecurringFilter,
  validateExpense,
  type ExpenseInput,
} from '../../../src/domain/expenses/model.ts'

describe('validateExpense', () => {
  const valid: ExpenseInput = {
    description: 'Coffee',
    amount: '12.50',
    categoryId: '1',
    recurring: undefined,
    date: undefined,
  }

  it('should accept an expense and trim its description', () => {
    assert.deepStrictEqual(validateExpense({...valid, description: '  Coffee  '}), {
      expense: {
        description: 'Coffee',
        amount: 12.5,
        categoryId: 1,
        recurring: false,
        date: undefined,
      },
    })
  })

  it('should accept an amount with no decimals', () => {
    assert.deepStrictEqual(validateExpense({...valid, amount: '6'}), {
      expense: {description: 'Coffee', amount: 6, categoryId: 1, recurring: false, date: undefined},
    })
  })

  it('should accept a recurring expense', () => {
    assert.deepStrictEqual(validateExpense({...valid, recurring: 'on'}), {
      expense: {
        description: 'Coffee',
        amount: 12.5,
        categoryId: 1,
        recurring: true,
        date: undefined,
      },
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
    assert.deepStrictEqual(
      validateExpense({
        description: '',
        amount: 'nope',
        categoryId: '99',
        recurring: undefined,
        date: undefined,
      }),
      {
        error: 'empty-description',
      },
    )
  })

  it('should accept a valid date string', () => {
    assert.deepStrictEqual(validateExpense({...valid, date: '2024-03-15'}), {
      expense: {
        description: 'Coffee',
        amount: 12.5,
        categoryId: 1,
        recurring: false,
        date: '2024-03-15',
      },
    })
  })

  for (const date of ['', 'yesterday', '2024-13-01', '2024-02-30', '15-03-2024']) {
    it(`should refuse the date ${JSON.stringify(date)}`, () => {
      assert.deepStrictEqual(validateExpense({...valid, date}), {error: 'invalid-date'})
    })
  }
})

describe('parseCategoryFilter', () => {
  it('should have no filter when nothing is asked for', () => {
    assert.deepStrictEqual(parseCategoryFilter([]), [])
  })

  it('should keep the ids that are categories', () => {
    assert.deepStrictEqual(parseCategoryFilter(['1', '3']), [1, 3])
  })

  it('should return the ids in category order, however the url ordered them', () => {
    assert.deepStrictEqual(parseCategoryFilter(['3', '1']), parseCategoryFilter(['1', '3']))
  })

  it('should count a repeated id once', () => {
    assert.deepStrictEqual(parseCategoryFilter(['2', '2']), [2])
  })

  // a bookmark may name a category that no longer exists, and should still show something
  for (const id of ['99', 'food', '', '1.5', '-1']) {
    it(`should drop the id ${JSON.stringify(id)}`, () => {
      assert.deepStrictEqual(parseCategoryFilter([id]), [])
    })
  }
})

describe('parseRecurringFilter', () => {
  it('should parse both recurring filter states', () => {
    assert.equal(parseRecurringFilter('exclude'), 'exclude')
    assert.equal(parseRecurringFilter('only'), 'only')
  })

  it('should use all expenses for a missing or stale filter', () => {
    assert.equal(parseRecurringFilter(undefined), 'all')
    assert.equal(parseRecurringFilter('old-value'), 'all')
  })
})
