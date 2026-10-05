import type {Page} from '@playwright/test'

export function createRevenuePageModel(page: Page) {
  return {
    urlRegex: /\/sales\/revenue$/,
    pageTitle: (locator = page.locator('h2')) => ({locator}),
    backToSalesLink: (locator = page.locator('a', {hasText: 'Back to Sales'})) => ({locator}),
    table: (locator = page.locator('table')) => ({
      locator,
      weekRow: (rowLocator = locator.locator('tbody tr').nth(0)) => ({
        locator: rowLocator,
        period: (cellLocator = rowLocator.locator('td').nth(0)) => ({locator: cellLocator}),
        amount: (cellLocator = rowLocator.locator('td').nth(1)) => ({locator: cellLocator}),
      }),
      monthRow: (rowLocator = locator.locator('tbody tr').nth(1)) => ({
        locator: rowLocator,
        period: (cellLocator = rowLocator.locator('td').nth(0)) => ({locator: cellLocator}),
        amount: (cellLocator = rowLocator.locator('td').nth(1)) => ({locator: cellLocator}),
      }),
      ytdRow: (rowLocator = locator.locator('tbody tr').nth(2)) => ({
        locator: rowLocator,
        period: (cellLocator = rowLocator.locator('td').nth(0)) => ({locator: cellLocator}),
        amount: (cellLocator = rowLocator.locator('td').nth(1)) => ({locator: cellLocator}),
      }),
      yearRow: (rowLocator = locator.locator('tbody tr').nth(3)) => ({
        locator: rowLocator,
        period: (cellLocator = rowLocator.locator('td').nth(0)) => ({locator: cellLocator}),
        amount: (cellLocator = rowLocator.locator('td').nth(1)) => ({locator: cellLocator}),
      }),
    }),
  }
}

export type RevenuePageModel = ReturnType<typeof createRevenuePageModel>
