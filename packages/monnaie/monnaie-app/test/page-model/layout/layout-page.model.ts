import type {Page} from '@playwright/test'

export function createLayoutPageModel(page: Page) {
  return {
    // the user menu has no role of its own, so it is found by its class
    userMenu: (locator = page.locator('.user-menu')) => ({
      locator,
      user: () => ({locator: locator.locator('.user-menu-user')}),
      logOutButton: () => ({locator: locator.getByRole('button', {name: 'Log out'})}),
    }),
  }
}
