import type {Page} from '@playwright/test'

export function createExpensesPageModel(page: Page) {
  return {
    heading: (locator = page.getByRole('heading', {name: 'Monnaie'})) => ({locator}),
    addButton: (locator = page.getByRole('link', {name: 'Add an expense'})) => ({locator}),
    summary: (locator = page.getByRole('region', {name: 'Summary'})) => ({
      locator,
      // a row of the table, whose two cells are the current and the previous total
      period: (name: string) => {
        const row = locator.getByRole('row', {name})

        return {
          locator: row,
          current: () => ({locator: row.getByRole('cell').nth(0)}),
          previous: () => ({locator: row.getByRole('cell').nth(1)}),
        }
      },
    }),
    list: (locator = page.getByRole('region', {name: 'This month'})) => ({
      locator,
      items: () => ({locator: locator.getByRole('listitem')}),
      empty: () => ({locator: locator.getByText('No expenses this month')}),
      item: (description: string) => {
        const item = locator.getByRole('listitem').filter({hasText: description})

        return {
          locator: item,
          editLink: () => ({locator: item.getByRole('link', {name: `Edit ${description}`})}),
          deleteButton: () => ({
            locator: item.getByRole('button', {name: `Delete ${description}`}),
          }),
        }
      },
    }),
  }
}
