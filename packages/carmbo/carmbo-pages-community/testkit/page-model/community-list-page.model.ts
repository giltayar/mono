import type {Page} from '@playwright/test'

export function createCommunityListPageModel(page: Page) {
  return {
    urlRegex: /\/communities$/,
    list: (locator = page.locator('table')) => ({
      locator,
      communityNumber: (communityNumber: number) => ({
        locator: locator.getByRole('button', {name: String(communityNumber), exact: true}),
      }),
      rows: (rowLocator = locator.locator('tbody tr')) => ({
        locator: rowLocator,
        row: (index: number, locator = rowLocator.nth(index)) => ({
          locator,
          idLink: (linkLocator = locator.locator('td a')) => ({locator: linkLocator}),
          nameCell: (cellLocator = locator.locator('td').nth(1)) => ({locator: cellLocator}),
          descriptionCell: (cellLocator = locator.locator('td').nth(2)) => ({
            locator: cellLocator,
          }),
        }),
      }),
    }),
    createNewCommunityButton: (locator = page.getByRole('button', {name: 'new community'})) => ({
      locator,
    }),
    search: (locator = page.getByLabel('Search')) => ({
      locator,
      showArchivedCheckbox: (locator = page.getByLabel('Show archived')) => ({locator}),
      queryInput: (locator = page.getByLabel('Search:')) => ({locator}),
    }),
  }
}

export type CommunityListPageModel = ReturnType<typeof createCommunityListPageModel>
