import type {Page} from '@playwright/test'

export function createProductHistoryPageModel(
  page: Page,
  locator = page.getByRole('list', {name: 'Product History'}),
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
