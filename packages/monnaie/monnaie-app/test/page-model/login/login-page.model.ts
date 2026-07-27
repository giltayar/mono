import type {Page} from '@playwright/test'

export function createLoginPageModel(page: Page) {
  return {
    heading: (locator = page.getByRole('heading', {name: 'Log in'})) => ({locator}),
    email: (locator = page.getByLabel('Email')) => ({locator}),
    password: (locator = page.getByLabel('Password')) => ({locator}),
    logInButton: (locator = page.getByRole('button', {name: 'Log in', exact: true})) => ({locator}),
    googleButton: (locator = page.getByRole('button', {name: 'Continue with Google'})) => ({
      locator,
    }),
    error: (locator = page.getByRole('alert')) => ({locator}),
  }
}
