import type {Page} from '@playwright/test'

export function createAllPagesPageModel(page: Page) {
  return {
    header: () => ({
      errorBanner: (locator = page.getByRole('alert')) => ({locator}),
    }),
  }
}
