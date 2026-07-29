import {expect, test, type Page} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {FIRST_USER, SECOND_USER} from '../services/fake-firebase-auth.ts'
import {createLoginPageModel} from '../../page-model/login/login-page.model.ts'
import {createLayoutPageModel} from '../../page-model/layout/layout-page.model.ts'
import {createExpensesPageModel} from '../../page-model/expenses/expenses-page.model.ts'
import {createExpenseFormPageModel} from '../../page-model/expenses/expense-form-page.model.ts'

const {url, logIn} = setup(import.meta.url)

const loginUrl = () => new URL('/login', url()).href

test('sends someone who is not logged in to the login page', async ({page}) => {
  const login = createLoginPageModel(page)

  await page.goto(url().href)

  await expect(page).toHaveURL(loginUrl())
  await expect(login.heading().locator).toBeVisible()
  await expect(login.googleButton().locator).toBeVisible()
})

test('logs in with an email and a password', async ({page}) => {
  const login = createLoginPageModel(page)
  const expenses = createExpensesPageModel(page)
  const layout = createLayoutPageModel(page)

  await page.goto(loginUrl())

  await login.email().locator.fill(FIRST_USER.email)
  await login.password().locator.fill(FIRST_USER.password)
  await login.logInButton().locator.click()

  await expect(page).toHaveURL(url().href)
  await expect(expenses.heading().locator).toBeVisible()
  await expect(layout.userMenu().user().locator).toHaveText(FIRST_USER.displayName ?? '')
})

test('shows the email of a user who has no name', async ({page}) => {
  const login = createLoginPageModel(page)
  const layout = createLayoutPageModel(page)

  await page.goto(loginUrl())

  await login.email().locator.fill(SECOND_USER.email)
  await login.password().locator.fill(SECOND_USER.password)
  await login.logInButton().locator.click()

  await expect(layout.userMenu().user().locator).toHaveText(SECOND_USER.email)
})

test('refuses a wrong password, without saying whether the email exists', async ({page}) => {
  const login = createLoginPageModel(page)

  await page.goto(loginUrl())

  await login.email().locator.fill(FIRST_USER.email)
  await login.password().locator.fill('not-the-password')
  await login.logInButton().locator.click()

  await expect(login.error().locator).toHaveText('Wrong email or password')
  await expect(page).toHaveURL(loginUrl())
})

test('refuses an unknown email with exactly the same message', async ({page}) => {
  const login = createLoginPageModel(page)

  await page.goto(loginUrl())

  await login.email().locator.fill('nobody@example.com')
  await login.password().locator.fill('any-password')
  await login.logInButton().locator.click()

  await expect(login.error().locator).toHaveText('Wrong email or password')
})

test('refuses a forged session cookie', async ({page}) => {
  await page.context().addCookies([{name: 'session', value: 'not-a-session', url: url().href}])

  await page.goto(url().href)

  await expect(page).toHaveURL(loginUrl())
})

test('sends someone who is already logged in from the login page to the app', async ({page}) => {
  const expenses = createExpensesPageModel(page)

  await logIn(page, FIRST_USER)

  await page.goto(loginUrl())

  await expect(page).toHaveURL(url().href)
  await expect(expenses.heading().locator).toBeVisible()
})

test('logs out', async ({page}) => {
  const layout = createLayoutPageModel(page)
  const login = createLoginPageModel(page)

  await logIn(page, FIRST_USER)
  await page.goto(url().href)

  await layout.userMenu().logOutButton().locator.click()

  await expect(page).toHaveURL(loginUrl())
  await expect(login.heading().locator).toBeVisible()

  // and the session really is gone, not just the page
  await page.goto(url().href)

  await expect(page).toHaveURL(loginUrl())
})

test('shows no user menu on the login page', async ({page}) => {
  const layout = createLayoutPageModel(page)

  await page.goto(loginUrl())

  await expect(layout.userMenu().locator).toHaveCount(0)
})

test('keeps the expenses of each user to themselves', async ({page}) => {
  const expenses = createExpensesPageModel(page)

  await logIn(page, FIRST_USER)
  await addExpense(page, 'Coffee', '12.50')

  await expect(expenses.list().items().locator).toHaveCount(1)
  await expect(expenses.list().item('Coffee').locator).toBeVisible()

  await logIn(page, SECOND_USER)
  await page.goto(url().href)

  await expect(expenses.list().empty().locator).toBeVisible()

  await addExpense(page, 'Bus ticket', '6')

  await expect(expenses.list().items().locator).toHaveCount(1)
  await expect(expenses.list().item('Bus ticket').locator).toBeVisible()

  // ...and the first user's expenses are untouched by anything the second one did
  await logIn(page, FIRST_USER)
  await page.goto(url().href)

  await expect(expenses.list().items().locator).toHaveCount(1)
  await expect(expenses.list().item('Coffee').locator).toBeVisible()
})

test('deletes only the expense of the user asking for it', async ({page}) => {
  const expenses = createExpensesPageModel(page)

  await logIn(page, FIRST_USER)
  await addExpense(page, 'Coffee', '12.50')

  await logIn(page, SECOND_USER)
  await addExpense(page, 'Bus ticket', '6')

  page.on('dialog', (dialog) => dialog.accept())
  await expenses.list().item('Bus ticket').deleteButton().locator.click()

  await expect(expenses.list().empty().locator).toBeVisible()

  await logIn(page, FIRST_USER)
  await page.goto(url().href)

  await expect(expenses.list().item('Coffee').locator).toBeVisible()
})

test('sends the browser to the login page when the session ends mid-visit', async ({page}) => {
  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)
  const login = createLoginPageModel(page)

  await logIn(page, FIRST_USER)
  await page.goto(url().href)
  await expenses.addButton().locator.click()

  await form.description().locator.fill('Coffee')
  await form.amount().locator.fill('12.50')
  await form.category('Food').locator.check()

  // the session goes away while the page stays open, so the next HTMX request is unauthenticated
  await page.context().clearCookies({name: 'session'})

  await form.submitButton().locator.click()

  await expect(page).toHaveURL(loginUrl())
  await expect(login.heading().locator).toBeVisible()
})

async function addExpense(page: Page, description: string, amount: string) {
  const expenses = createExpensesPageModel(page)
  const form = createExpenseFormPageModel(page)

  await page.goto(url().href)
  await expenses.addButton().locator.click()

  await form.description().locator.fill(description)
  await form.amount().locator.fill(amount)
  await form.category('Food').locator.check()
  await form.submitButton().locator.click()

  await expect(page).toHaveURL(url().href)
}
