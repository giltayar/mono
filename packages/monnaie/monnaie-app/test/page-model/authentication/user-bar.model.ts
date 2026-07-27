import type {Page} from '@playwright/test'

export function createUserBarPageModel(page: Page) {
  return {
    email: (locator = page.locator('.user-bar .email')) => ({locator}),
    signOutButton: (locator = page.getByRole('button', {name: 'Sign out'})) => ({locator}),
  }
}
