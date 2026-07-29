import {expect, test, type Page} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {FIRST_USER} from '../services/fake-firebase-auth.ts'
import {createLoginPageModel} from '../../page-model/login/login-page.model.ts'
import {createRegistrationPageModel} from '../../page-model/login/registration-page.model.ts'
import {createExpensesPageModel} from '../../page-model/expenses/expenses-page.model.ts'

const {url, db, auth, logIn} = setup(import.meta.url)

const loginUrl = () => new URL('/login', url()).href
const registerUrl = () => new URL('/register', url()).href

const NEW_EMAIL = 'newcomer@example.com'
const NEW_PASSWORD = 'a-long-enough-password'
const NEW_REGISTRATION = {
  email: NEW_EMAIL,
  password: NEW_PASSWORD,
  confirmPassword: NEW_PASSWORD,
}

async function register(
  page: Page,
  {email, password, confirmPassword}: {email: string; password: string; confirmPassword: string},
) {
  const registration = createRegistrationPageModel(page)

  await page.goto(registerUrl())

  await registration.email().locator.fill(email)
  await registration.password().locator.fill(password)
  await registration.confirmPassword().locator.fill(confirmPassword)
  await registration.registerButton().locator.click()
}

async function userRows() {
  return await db().selectFrom('app_user').selectAll().execute()
}

test('registers an account, and says an email is on its way', async ({page}) => {
  const registration = createRegistrationPageModel(page)

  await register(page, NEW_REGISTRATION)

  await expect(registration.verificationSent().locator).toBeVisible()
  await expect(page.getByText(NEW_EMAIL)).toBeVisible()
  expect(auth().sentEmails()).toEqual([{type: 'verification', email: NEW_EMAIL}])
})

test('gives the new account a row, remembering the language it registered in', async ({page}) => {
  await register(page, NEW_REGISTRATION)

  expect(await userRows()).toMatchObject([{settings: {language: 'en'}}])
})

test('does not let the new account in until the email has been confirmed', async ({page}) => {
  const login = createLoginPageModel(page)

  await register(page, NEW_REGISTRATION)

  await page.goto(loginUrl())
  await login.email().locator.fill(NEW_EMAIL)
  await login.password().locator.fill(NEW_PASSWORD)
  await login.logInButton().locator.click()

  await expect(page).toHaveURL(loginUrl())
  await expect(login.error().locator).toHaveText(
    'Your email has not been confirmed yet. We have sent you the link again.',
  )
  // trying to log in is what asks for another link, which is why there is no "resend" button
  expect(auth().sentEmails()).toEqual([
    {type: 'verification', email: NEW_EMAIL},
    {type: 'verification', email: NEW_EMAIL},
  ])
})

test('lets the new account in once the email has been confirmed', async ({page}) => {
  const login = createLoginPageModel(page)
  const expenses = createExpensesPageModel(page)

  await register(page, NEW_REGISTRATION)

  // stands in for the user clicking the link Firebase sent them
  auth().markVerified(NEW_EMAIL)

  await page.goto(loginUrl())
  await login.email().locator.fill(NEW_EMAIL)
  await login.password().locator.fill(NEW_PASSWORD)
  await login.logInButton().locator.click()

  await expect(page).toHaveURL(url().href)
  await expect(expenses.heading().locator).toBeVisible()
})

test('answers an email that already has an account exactly as it answers a new one', async ({
  page,
}) => {
  const registration = createRegistrationPageModel(page)

  await register(page, {...NEW_REGISTRATION, email: FIRST_USER.email})

  await expect(registration.verificationSent().locator).toBeVisible()
  // ...but what is sent is a password reset, which is the only place the difference shows
  expect(auth().sentEmails()).toEqual([{type: 'password-reset', email: FIRST_USER.email}])
  // and nothing was created: the existing user keeps their account, and gets no second row
  expect(await userRows()).toEqual([])
})

test('refuses two passwords that are not the same', async ({page}) => {
  const registration = createRegistrationPageModel(page)

  await register(page, {...NEW_REGISTRATION, confirmPassword: 'something-else-entirely'})

  await expect(registration.error().locator).toHaveText('The two passwords are not the same')
  expect(auth().sentEmails()).toEqual([])
  expect(await userRows()).toEqual([])
})

test('refuses a password that is too short, without even asking the server', async ({page}) => {
  const registration = createRegistrationPageModel(page)

  await register(page, {...NEW_REGISTRATION, password: 'short'})

  // `minlength` on the input means the browser itself stops the submit, so we never leave the page
  await expect(page).toHaveURL(registerUrl())
  await expect(registration.registerButton().locator).toBeVisible()
  expect(auth().sentEmails()).toEqual([])
  expect(await userRows()).toEqual([])
})

test('refuses a password that is too short even when the browser is bypassed', async ({page}) => {
  const response = await page.request.post(registerUrl(), {
    form: {email: NEW_EMAIL, password: 'short', confirmPassword: 'short'},
  })

  expect(response.status()).toBe(400)
  expect(await response.text()).toContain('The password is too short')
  expect(auth().sentEmails()).toEqual([])
  expect(await userRows()).toEqual([])
})

test('keeps the email that was typed when it complains about the password', async ({page}) => {
  const registration = createRegistrationPageModel(page)

  await register(page, {...NEW_REGISTRATION, confirmPassword: 'something-else-entirely'})

  await expect(registration.email().locator).toHaveValue(NEW_EMAIL)
  await expect(registration.password().locator).toHaveValue('')
})

test('sends someone who is already logged in from the registration page to the app', async ({
  page,
}) => {
  const expenses = createExpensesPageModel(page)

  await logIn(page, FIRST_USER)

  await page.goto(registerUrl())

  await expect(page).toHaveURL(url().href)
  await expect(expenses.heading().locator).toBeVisible()
})

test('gets to the registration page from the login page, and back', async ({page}) => {
  const login = createLoginPageModel(page)
  const registration = createRegistrationPageModel(page)

  await page.goto(loginUrl())
  await login.registerLink().locator.click()

  await expect(registration.heading().locator).toBeVisible()

  await registration.logInLink().locator.click()

  await expect(login.heading().locator).toBeVisible()
})

test('gives a user who was created straight in Firebase a row on their first login', async ({
  page,
}) => {
  const login = createLoginPageModel(page)
  const expenses = createExpensesPageModel(page)

  // as if somebody had added them by hand in the Firebase console, and confirmed their address
  auth().addUser({
    uid: 'by-hand',
    email: 'byhand@example.com',
    password: 'made-in-the-console',
    displayName: undefined,
    emailVerified: true,
  })

  await page.goto(loginUrl())
  await login.email().locator.fill('byhand@example.com')
  await login.password().locator.fill('made-in-the-console')
  await login.logInButton().locator.click()

  await expect(expenses.heading().locator).toBeVisible()
  expect(await userRows()).toMatchObject([{user_id: 'by-hand'}])
})
