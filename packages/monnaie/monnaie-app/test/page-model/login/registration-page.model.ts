import type {Page} from '@playwright/test'

export function createRegistrationPageModel(page: Page) {
  return {
    heading: (locator = page.getByRole('heading', {name: 'Create an account'})) => ({locator}),
    email: (locator = page.getByLabel('Email')) => ({locator}),
    // exact, or it would also match "Confirm password"
    password: (locator = page.getByLabel('Password', {exact: true})) => ({locator}),
    confirmPassword: (locator = page.getByLabel('Confirm password')) => ({locator}),
    registerButton: (locator = page.getByRole('button', {name: 'Create account'})) => ({locator}),
    logInLink: (locator = page.getByRole('link', {name: 'Log in instead'})) => ({locator}),
    error: (locator = page.getByRole('alert')) => ({locator}),
    verificationSent: (locator = page.getByRole('heading', {name: 'Check your email'})) => ({
      locator,
    }),
  }
}
