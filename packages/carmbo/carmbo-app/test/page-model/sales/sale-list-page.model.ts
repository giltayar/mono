import type {Page} from '@playwright/test'

export function createSaleListPageModel(page: Page) {
  return {
    urlRegex: /\/sales$/,
    list: (locator = page.locator('table')) => ({
      locator,
      rows: (rowLocator = locator.locator('tbody tr')) => ({
        locator: rowLocator,
        row: (index: number, locator = rowLocator.nth(index)) => ({
          locator,
          idLink: (linkLocator = locator.locator('td a').first()) => ({locator: linkLocator}),
          saleNumberCell: (cellLocator = locator.locator('td').nth(0)) => ({
            locator: cellLocator,
          }),
          dateCell: (cellLocator = locator.locator('td').nth(1)) => ({locator: cellLocator}),
          eventCell: (cellLocator = locator.locator('td').nth(2)) => ({locator: cellLocator}),
          studentCell: (cellLocator = locator.locator('td').nth(3)) => ({locator: cellLocator}),
          revenueCell: (cellLocator = locator.locator('td').nth(4)) => ({locator: cellLocator}),
          productsCell: (cellLocator = locator.locator('td').nth(5)) => ({locator: cellLocator}),
        }),
      }),
    }),
    search: (locator = page.getByLabel('Search')) => ({
      locator,
      showArchivedCheckbox: (locator = page.getByLabel('Show archived')) => ({locator}),
      queryInput: (locator = page.getByLabel('Search:')) => ({locator}),
    }),
  }
}

export type SaleListPageModel = ReturnType<typeof createSaleListPageModel>
