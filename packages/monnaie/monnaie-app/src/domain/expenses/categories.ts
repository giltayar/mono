/**
 * The categories an expense can be filed under. Hardcoded, English-only and deliberately *not*
 * translated: they are about to become rows that each user edits for themselves, and a user's own
 * category name has no translation either. Ids are what the `expense` table stores, so an id is
 * permanent — add categories at the end, and never reuse an id that has been given out.
 */
export const EXPENSE_CATEGORIES = [
  {id: 1, name: 'Food'},
  {id: 2, name: 'Transport'},
  {id: 3, name: 'Housing'},
  {id: 4, name: 'Health'},
  {id: 5, name: 'Entertainment'},
  {id: 6, name: 'Shopping'},
  {id: 7, name: 'Bills'},
  {id: 8, name: 'Other'},
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export function categoryById(id: number): ExpenseCategory | undefined {
  return EXPENSE_CATEGORIES.find((category) => category.id === id)
}

export function isKnownCategoryId(id: number): boolean {
  return categoryById(id) !== undefined
}
