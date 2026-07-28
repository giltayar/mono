import type {Page} from '@playwright/test'

export function createForgotPasswordPageModel(page: Page) {
  return {
    heading: (locator = page.getByRole('heading', {name: 'Reset your password'})) => ({locator}),
    email: (locator = page.getByLabel('Email')) => ({locator}),
    sendButton: (locator = page.getByRole('button', {name: 'Send the link'})) => ({locator}),
    logInLink: (locator = page.getByRole('link', {name: 'Log in instead'})) => ({locator}),
    error: (locator = page.getByRole('alert')) => ({locator}),
    resetSent: (locator = page.getByRole('heading', {name: 'Check your email'})) => ({locator}),
  }
}
