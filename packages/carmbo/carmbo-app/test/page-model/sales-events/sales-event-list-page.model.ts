import type {Page} from '@playwright/test'

export function createSalesEventListPageModel(page: Page) {
  return {
    urlRegex: /\/sales-events$/,
    list: (locator = page.locator('table')) => ({
      locator,
      rows: (rowLocator = locator.locator('tbody tr')) => ({
        locator: rowLocator,
        row: (index: number, locator = rowLocator.nth(index)) => ({
          locator,
          idLink: (linkLocator = locator.locator('td a')) => ({locator: linkLocator}),
          nameCell: (cellLocator = locator.locator('td').nth(1)) => ({locator: cellLocator}),
          datesCell: (cellLocator = locator.locator('td').nth(2)) => ({locator: cellLocator}),
          productsCell: (cellLocator = locator.locator('td').nth(3)) => ({locator: cellLocator}),
        }),
      }),
    }),
    createNewSalesEventButton: (locator = page.getByRole('button', {name: 'new sales event'})) => ({
      locator,
    }),
    search: (locator = page.getByLabel('Search')) => ({
      locator,
      showArchivedCheckbox: (locator = page.getByLabel('Show archived')) => ({locator}),
      queryInput: (locator = page.getByLabel('Search:')) => ({locator}),
    }),
  }
}

export type SalesEventListPageModel = ReturnType<typeof createSalesEventListPageModel>
