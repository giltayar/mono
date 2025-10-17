import type {Page} from '@playwright/test'

export function createSaleHistoryPageModel(
  page: Page,
  locator = page.getByRole('list', {name: 'Sale History'}),
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

export type SaleHistoryPageModel = ReturnType<typeof createSaleHistoryPageModel>
