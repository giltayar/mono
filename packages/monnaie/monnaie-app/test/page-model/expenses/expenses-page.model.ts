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
        const current = row.getByRole('cell').nth(0)
        const previous = row.getByRole('cell').nth(1)

        return {
          locator: row,
          current: () => ({
            locator: current.locator('.total'),
            dailyAverage: () => ({locator: current.locator('.daily-average')}),
          }),
          previous: () => ({
            locator: previous.locator('.total'),
            dailyAverage: () => ({locator: previous.locator('.daily-average')}),
          }),
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
