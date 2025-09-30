import type {Page} from '@playwright/test'

export function createProductListPageModel(page: Page) {
  return {
    urlRegex: /\/products$/,
    list: (locator = page.locator('table')) => ({
      locator,
      rows: (rowLocator = locator.locator('tbody tr')) => ({
        locator: rowLocator,
        row: (index: number, locator = rowLocator.nth(index)) => ({
          locator,
          idLink: (linkLocator = locator.locator('td a')) => ({locator: linkLocator}),
          nameCell: (cellLocator = locator.locator('td').nth(1)) => ({locator: cellLocator}),
          typeCell: (cellLocator = locator.locator('td').nth(2)) => ({locator: cellLocator}),
        }),
      }),
    }),
    createNewProductButton: (locator = page.getByRole('button', {name: 'new product'})) => ({
      locator,
    }),
    search: (locator = page.getByLabel('Search')) => ({
      locator,
      showArchivedCheckbox: (locator = page.getByLabel('Show archived')) => ({locator}),
      queryInput: (locator = page.getByLabel('Search:')) => ({locator}),
    }),
  }
}

export type ProductListPageModel = ReturnType<typeof createProductListPageModel>
