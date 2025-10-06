import type {Page} from '@playwright/test'

export function createStudentHistoryPageModel(
  page: Page,
  locator = page.getByRole('list', {name: 'History'}),
) {
  return {
    locator,
    items: (itemsLocator = locator.getByRole('listitem')) => ({
      locator: itemsLocator,
      item: (index: number) => ({
        locator: itemsLocator.nth(index),
        link: (linkLocator = itemsLocator.nth(index).getByRole('link')) => ({
          locator: linkLocator,
        }),
      }),
    }),
  }
}
