import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
  categoryById,
  EXPENSE_CATEGORIES,
  isKnownCategoryId,
} from '../../../src/domain/expenses/categories.ts'

describe('expense categories', () => {
  it('should give every category a unique id', () => {
    const ids = EXPENSE_CATEGORIES.map((category) => category.id)

    assert.deepStrictEqual([...new Set(ids)], ids)
  })

  it('should give every category a unique name', () => {
    const names = EXPENSE_CATEGORIES.map((category) => category.name)

    assert.deepStrictEqual([...new Set(names)], names)
  })

  it('should find every category by its id', () => {
    for (const category of EXPENSE_CATEGORIES) {
      assert.deepStrictEqual(categoryById(category.id), category)
      assert.ok(isKnownCategoryId(category.id))
    }
  })

  it('should not find a category that does not exist', () => {
    assert.strictEqual(categoryById(0), undefined)
    assert.strictEqual(isKnownCategoryId(EXPENSE_CATEGORIES.length + 1), false)
  })
})
