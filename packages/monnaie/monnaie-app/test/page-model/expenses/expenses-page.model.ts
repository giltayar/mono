import type {Page} from '@playwright/test'

export function createExpensesPageModel(page: Page) {
  return {
    heading: (locator = page.getByRole('heading', {name: 'Monnaie'})) => ({
      locator,
      link: () => ({locator: locator.getByRole('link')}),
    }),
    addButton: (locator = page.getByRole('link', {name: 'Add an expense'})) => ({locator}),
    copyRecurringButton: (
      locator = page.getByRole('button', {name: 'Copy recurring', exact: true}),
    ) => ({locator}),
    filter: (locator = page.locator('#category-filter')) => ({
      locator,
      toggle: () => ({locator: locator.getByRole('button', {name: 'Filter', exact: true})}),
      category: (name: string) => ({locator: locator.getByRole('checkbox', {name})}),
      expenseType: (name: 'Day to day' | 'Special' | 'Recurring') => ({
        locator: locator.getByRole('checkbox', {name, exact: true}),
      }),
    }),
    tabs: (locator = page.getByRole('navigation', {name: 'Monthly views'})) => ({
      locator,
      expenses: () => ({locator: locator.getByRole('link', {name: 'Expenses'})}),
      graphs: () => ({locator: locator.getByRole('link', {name: 'Graphs'})}),
    }),
    summary: (locator = page.getByRole('region', {name: 'Summary'})) => ({
      locator,
      heading: (heading = locator.getByRole('heading')) => ({
        locator: heading,
        link: () => ({locator: heading.getByRole('link')}),
      }),
      // a row of the table, whose two cells are the current and the previous total
      period: (name: string) => {
        const row = locator.getByRole('row', {name})
        const current = row.getByRole('cell').nth(0)
        const previous = row.getByRole('cell').nth(1)

        return {
          locator: row,
          backward: () => ({locator: row.getByRole('link', {name: `Previous ${name}`})}),
          forward: () => ({locator: row.getByRole('link', {name: `Next ${name}`})}),
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
          recurring: () => ({locator: item.locator('.expense-recurring')}),
          special: () => ({locator: item.locator('.expense-special')}),
          editLink: () => ({locator: item.getByRole('link', {name: `Edit ${description}`})}),
          deleteButton: () => ({
            locator: item.getByRole('button', {name: `Delete ${description}`}),
          }),
        }
      },
    }),
    graph: (locator = page.locator('#expense-graph')) => ({
      locator,
      canvas: () => ({
        locator: locator.getByRole('img', {name: 'Expenses by category this month'}),
      }),
      empty: () => ({locator: locator.getByText('No expenses to graph this month')}),
      entries: () => ({locator: locator.locator('.chart-legend li')}),
      entry: (category: string) => ({
        locator: locator.locator('.chart-legend li').filter({hasText: category}),
      }),
    }),
  }
}
