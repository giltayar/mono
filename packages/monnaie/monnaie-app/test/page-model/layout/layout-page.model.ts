import type {Page} from '@playwright/test'

export function createLayoutPageModel(page: Page) {
  return {
    userMenu: (locator = page.locator('.user-menu')) => ({
      locator,
      settingsLink: () => ({locator: locator.getByRole('link', {name: 'Settings'})}),
    }),
  }
}
