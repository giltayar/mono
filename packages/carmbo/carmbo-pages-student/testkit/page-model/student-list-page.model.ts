import type {Page} from '@playwright/test'

export function createStudentListPageModel(page: Page) {
  return {
    urlRegex: /\/students$/,
    list: (locator = page.locator('table')) => ({
      locator,
      rows: (rowLocator = locator.locator('tbody tr')) => ({
        locator: rowLocator,
        row: (index: number, locator = rowLocator.nth(index)) => ({
          locator,
          idLink: (linkLocator = locator.locator('td a')) => ({locator: linkLocator}),
          nameCell: (cellLocator = locator.locator('td').nth(1)) => ({locator: cellLocator}),
          emailCell: (cellLocator = locator.locator('td').nth(2)) => ({locator: cellLocator}),
          phoneCell: (cellLocator = locator.locator('td').nth(3)) => ({locator: cellLocator}),
        }),
      }),
    }),
    createNewStudentButton: (locator = page.getByRole('button', {name: 'new student'})) => ({
      locator,
    }),
    search: (locator = page.getByLabel('Search')) => ({
      locator,
      showArchivedCheckbox: (locator = page.getByLabel('Show archived')) => ({locator}),
      queryInput: (locator = page.getByLabel('Search:')) => ({locator}),
    }),
  }
}

export type StudentListPageModel = ReturnType<typeof createStudentListPageModel>
