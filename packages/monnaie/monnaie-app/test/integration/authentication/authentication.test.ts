import {expect, test, type Page} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {fakeIdToken} from '../common/fake-auth.ts'
import {createLoginPageModel} from '../../page-model/authentication/login-page.model.ts'
import {createUserBarPageModel} from '../../page-model/authentication/user-bar.model.ts'
import {createCalculatorPageModel} from '../../page-model/calculator/calculator-page.model.ts'

const {url, signIn} = setup(import.meta.url)

// signing in itself happens in the browser, against the identity provider, so it is the one thing
// these tests cannot exercise — `test/e2e` does that against a real firebase project

test('sends an anonymous visitor to the login page', async ({page}) => {
  await page.goto(url().href)
  const login = createLoginPageModel(page)

  await expect(login.heading().locator).toBeVisible()
  await expect(login.emailInput().locator).toBeVisible()
  await expect(login.passwordInput().locator).toBeVisible()
  expect(new URL(page.url()).searchParams.get('next')).toBe('/')
})

test('shows the calculator once a session cookie has been issued', async ({page}) => {
  await signIn(page, 'alice@example.com')

  await page.goto(url().href)

  await expect(createCalculatorPageModel(page).heading().locator).toBeVisible()
  await expect(createUserBarPageModel(page).email().locator).toHaveText('alice@example.com')
})

test('refuses an ID token the identity provider does not recognize', async ({page}) => {
  const response = await page.request.post(new URL('/session', url()).href, {
    data: {idToken: 'not-an-id-token'},
  })

  expect(response.status()).toBe(401)

  await page.goto(url().href)

  await expect(createLoginPageModel(page).heading().locator).toBeVisible()
})

test('signs out, and forgets the session', async ({page}) => {
  await signIn(page, 'alice@example.com')
  await page.goto(url().href)

  await createUserBarPageModel(page).signOutButton().locator.click()

  await expect(createLoginPageModel(page).heading().locator).toBeVisible()

  await page.goto(url().href)

  await expect(createLoginPageModel(page).heading().locator).toBeVisible()
})

test('tells htmx to navigate to the login page when the session has expired', async ({page}) => {
  const response = await page.request.post(new URL('/calculate', url()).href, {
    headers: {'HX-Request': 'true'},
    form: {expression: '1 + 1'},
  })

  expect(response.status()).toBe(204)
  expect(response.headers()['hx-redirect']).toBe('/login?next=%2Fcalculate')
})

test('returns the visitor to the page they came from', async ({page}) => {
  await page.goto(new URL('/login?next=%2Fsomewhere', url()).href)

  expect(await returnPathOf(page)).toBe('/somewhere')
})

test('never returns the visitor to another site', async ({page}) => {
  await page.goto(new URL('/login?next=%2F%2Fevil.example.com', url()).href)

  expect(await returnPathOf(page)).toBe('/')
})

test('keeps each user’s history to themselves', async ({page}) => {
  await signIn(page, 'alice@example.com')
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculationInput().locator.fill('12 + 30')
  await calculator.calculateButton().locator.click()
  await expect(calculator.history().items().locator).toHaveText([/12 \+ 30\s*= 42/])

  await signIn(page, 'bob@example.com')
  await page.goto(url().href)

  await expect(calculator.history().empty().locator).toBeVisible()
})

test('does not let one user delete another user’s history', async ({page}) => {
  await signIn(page, 'alice@example.com')
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculationInput().locator.fill('12 + 30')
  await calculator.calculateButton().locator.click()
  await expect(calculator.history().items().locator).toHaveText([/12 \+ 30\s*= 42/])

  await page.request.post(new URL('/session', url()).href, {
    data: {idToken: fakeIdToken('bob@example.com')},
  })
  await page.request.delete(new URL('/history', url()).href)

  await signIn(page, 'alice@example.com')
  await page.goto(url().href)

  await expect(calculator.history().items().locator).toHaveText([/12 \+ 30\s*= 42/])
})

async function returnPathOf(page: Page): Promise<string> {
  const config = await createLoginPageModel(page).form().locator.getAttribute('data-login-config')

  return JSON.parse(config ?? '{}').next
}
