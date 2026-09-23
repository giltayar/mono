import type {Page} from '@playwright/test'

export function createSettingsPageModel(page: Page) {
  return {
    heading: () => ({locator: page.getByRole('heading', {name: 'Settings', level: 1})}),
    email: () => ({locator: page.locator('.settings-email')}),
    language: () => ({locator: page.getByLabel('Language')}),
    installSection: () => ({locator: page.locator('#install-app')}),
    installButton: () => ({locator: page.getByRole('button', {name: 'Install app'})}),
    iosInstallInstructions: () => ({locator: page.locator('#install-ios-instructions')}),
    logOutButton: () => ({locator: page.getByRole('button', {name: 'Log out'})}),
  }
}
