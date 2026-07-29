import {expect, test} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {FIRST_USER} from '../services/fake-firebase-auth.ts'
import {createLoginPageModel} from '../../page-model/login/login-page.model.ts'
import {createForgotPasswordPageModel} from '../../page-model/login/forgot-password-page.model.ts'
import {createExpensesPageModel} from '../../page-model/expenses/expenses-page.model.ts'

const {url, auth, logIn} = setup(import.meta.url)

const loginUrl = () => new URL('/login', url()).href
const forgotPasswordUrl = () => new URL('/forgot-password', url()).href

const UNKNOWN_EMAIL = 'nobody@example.com'

test('gets to the forgot-password page from the login page, and back', async ({page}) => {
  const login = createLoginPageModel(page)
  const forgotPassword = createForgotPasswordPageModel(page)

  await page.goto(loginUrl())
  await login.forgotPasswordLink().locator.click()

  await expect(forgotPassword.heading().locator).toBeVisible()

  await forgotPassword.logInLink().locator.click()

  await expect(login.heading().locator).toBeVisible()
})

test('sends a reset link, and says an email is on its way', async ({page}) => {
  const forgotPassword = createForgotPasswordPageModel(page)

  await page.goto(forgotPasswordUrl())
  await forgotPassword.email().locator.fill(FIRST_USER.email)
  await forgotPassword.sendButton().locator.click()

  await expect(forgotPassword.resetSent().locator).toBeVisible()
  await expect(page.getByText(FIRST_USER.email)).toBeVisible()
  expect(auth().sentEmails()).toEqual([{type: 'password-reset', email: FIRST_USER.email}])
})

test('answers an email with no account exactly as it answers one that has one', async ({page}) => {
  const forgotPassword = createForgotPasswordPageModel(page)

  await page.goto(forgotPasswordUrl())
  await forgotPassword.email().locator.fill(UNKNOWN_EMAIL)
  await forgotPassword.sendButton().locator.click()

  await expect(forgotPassword.resetSent().locator).toBeVisible()
  await expect(page.getByText(UNKNOWN_EMAIL)).toBeVisible()
})

test('refuses something that is not an email even when the browser is bypassed', async ({page}) => {
  const response = await page.request.post(forgotPasswordUrl(), {form: {email: 'not-an-email'}})

  expect(response.status()).toBe(400)
  expect(await response.text()).toContain('That does not look like an email address')
  expect(auth().sentEmails()).toEqual([])
})

test('keeps the email that was typed when it complains about it', async ({page}) => {
  // `type="email"` means the browser itself stops a submit of something malformed, so the
  // server-side complaint is only reachable by posting the form directly
  const response = await page.request.post(forgotPasswordUrl(), {form: {email: 'someone@'}})

  expect(await response.text()).toContain('value="someone@"')
})

test('sends someone who is already logged in to the app', async ({page}) => {
  const expenses = createExpensesPageModel(page)

  await logIn(page, FIRST_USER)

  await page.goto(forgotPasswordUrl())

  await expect(page).toHaveURL(url().href)
  await expect(expenses.heading().locator).toBeVisible()
})
