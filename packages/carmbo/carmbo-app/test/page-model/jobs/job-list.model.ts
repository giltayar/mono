import type {Locator} from '@playwright/test'

export function createJobListModel(tableLocator: Locator) {
  return {
    locator: tableLocator,
    rows: (rowLocator = tableLocator.locator('tbody tr')) => ({
      locator: rowLocator,
      row: (index: number, locator = rowLocator.nth(index)) => ({
        locator,
        idLink: (linkLocator = locator.locator('td a')) => ({locator: linkLocator}),
        descriptionCell: (cellLocator = locator.locator('td').nth(1)) => ({locator: cellLocator}),
        createdAtCell: (cellLocator = locator.locator('td').nth(2)) => ({locator: cellLocator}),
        progressCell: (cellLocator = locator.locator('td').nth(3)) => ({locator: cellLocator}),
        statusCell: (cellLocator = locator.locator('td').nth(4)) => ({
          locator: cellLocator,
          errorSpan: (spanLocator = cellLocator.locator('span.error')) => ({
            locator: spanLocator,
          }),
        }),
      }),
    }),
  }
}

export type JobListModel = ReturnType<typeof createJobListModel>
