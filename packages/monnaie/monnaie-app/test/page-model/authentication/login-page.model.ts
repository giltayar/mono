import type {Page} from '@playwright/test'

export function createLoginPageModel(page: Page) {
  return {
    heading: (locator = page.getByRole('heading', {name: 'Sign in'})) => ({locator}),
    form: (locator = page.locator('#login-form')) => ({locator}),
    emailInput: (locator = page.getByLabel('Email')) => ({locator}),
    passwordInput: (locator = page.getByLabel('Password')) => ({locator}),
    signInButton: (locator = page.getByRole('button', {name: 'Sign in'})) => ({locator}),
    error: (locator = page.getByRole('alert')) => ({locator}),
  }
}
