import type {Page} from '@playwright/test'
import {createAllPagesPageModel} from '../common/all-pages.model.ts'

export function createSalePaymentsPageModel(page: Page) {
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/sales\/\d+\/payments$/,
    pageTitle: (locator = page.getByRole('heading', {level: 2})) => ({locator}),
    paymentsTable: (tableLocator = page.getByRole('table')) => ({
      locator: tableLocator,
      rows: (rowsLocator = tableLocator.locator('tbody tr')) => ({
        locator: rowsLocator,
        row: (index: number, rowLocator = rowsLocator.nth(index)) => ({
          locator: rowLocator,
          dateCell: (cellLocator = rowLocator.locator('td').nth(0)) => ({
            locator: cellLocator,
          }),
          amountCell: (cellLocator = rowLocator.locator('td').nth(1)) => ({
            locator: cellLocator,
          }),
          resolutionCell: (cellLocator = rowLocator.locator('td').nth(2)) => ({
            locator: cellLocator,
          }),
          invoiceNumberCell: (cellLocator = rowLocator.locator('td').nth(3)) => ({
            locator: cellLocator,
          }),
        }),
      }),
    }),
  }
}

export type SalePaymentsPageModel = ReturnType<typeof createSalePaymentsPageModel>
