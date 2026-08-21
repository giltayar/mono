/**
 * The categories an expense can be filed under. Hardcoded, English-only and deliberately *not*
 * translated: they are about to become rows that each user edits for themselves, and a user's own
 * category name has no translation either. Ids are what the `expense` table stores, so an id is
 * permanent — add categories at the end, and never reuse an id that has been given out.
 */
export const EXPENSE_CATEGORIES = [
  {id: 1, name: 'אוכל'},
  {id: 2, name: 'תחבורה'},
  {id: 3, name: 'בית'},
  {id: 4, name: 'בריאות'},
  {id: 5, name: 'בילוי'},
  {id: 6, name: 'קניות'},
  {id: 7, name: 'הלוואה'},
  {id: 8, name: 'חינוך'},
  {id: 9, name: 'מתנה'},
  {id: 10, name: 'חופשה'},
  {id: 11, name: 'ביגוד'},
  {id: 13, name: 'דמי כיס'},
  {id: 14, name: 'עסק'},
  {id: 15, name: 'טיפוח'},
  {id: 16, name: 'תרבות'},
  {id: 12, name: 'אחר'},
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export function categoryById(id: number): ExpenseCategory | undefined {
  return EXPENSE_CATEGORIES.find((category) => category.id === id)
}

export function isKnownCategoryId(id: number): boolean {
  return categoryById(id) !== undefined
}
