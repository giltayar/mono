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
    registerLink: (locator = page.getByRole('link', {name: 'Create an account'})) => ({locator}),
    forgotPasswordLink: (locator = page.getByRole('link', {name: 'Forgot your password?'})) => ({
      locator,
    }),
    error: (locator = page.getByRole('alert')) => ({locator}),
  }
}
