import type {Page} from '@playwright/test'

export function createExpenseFormPageModel(page: Page) {
  return {
    addHeading: (locator = page.getByRole('heading', {name: 'Add an expense'})) => ({locator}),
    editHeading: (locator = page.getByRole('heading', {name: 'Edit the expense'})) => ({locator}),
    description: (locator = page.getByRole('textbox', {name: 'What was it'})) => ({locator}),
    amount: (locator = page.getByRole('spinbutton', {name: 'Amount'})) => ({locator}),
    date: (locator = page.getByLabel('Date')) => ({locator}),
    // the radios are visually hidden and styled through their label, but they are still radios
    category: (name: string) => ({locator: page.getByRole('radio', {name})}),
    expenseType: (name: 'Day to day' | 'Recurring' | 'Special') => ({
      locator: page.getByRole('radio', {name}),
    }),
    submitButton: (locator = page.getByRole('button', {name: /^(Add|Save)$/})) => ({locator}),
    cancelLink: (locator = page.getByRole('link', {name: 'Cancel'})) => ({locator}),
    error: (locator = page.getByRole('alert')) => ({locator}),
  }
}
