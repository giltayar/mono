import type {Page} from '@playwright/test'

export function createSettingsPageModel(page: Page) {
  return {
    heading: () => ({locator: page.getByRole('heading', {name: 'Settings', level: 1})}),
    email: () => ({locator: page.locator('.settings-email')}),
    language: () => ({locator: page.getByLabel('Language')}),
    logOutButton: () => ({locator: page.getByRole('button', {name: 'Log out'})}),
  }
}
