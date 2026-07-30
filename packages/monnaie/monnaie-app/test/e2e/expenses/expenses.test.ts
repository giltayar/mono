import {expect, test} from '@playwright/test'
import {firebaseCredentials, setup} from '../common/setup.ts'
import {createLoginPageModel} from '../../page-model/login/login-page.model.ts'
import {createExpensesPageModel} from '../../page-model/expenses/expenses-page.model.ts'
import {createExpenseFormPageModel} from '../../page-model/expenses/expense-form-page.model.ts'

const credentials = firebaseCredentials()

test.describe('the published image', () => {
  test.skip(
    credentials === undefined,
    'needs MONNAIE_FIREBASE_API_KEY, MONNAIE_FIREBASE_SERVICE_ACCOUNT, MONNAIE_FIREBASE_TEST_EMAIL and MONNAIE_FIREBASE_TEST_PASSWORD',
  )

  const {url} = setup(credentials!)

  test('logs in and records an expense', async ({page}) => {
    const login = createLoginPageModel(page)
    const expenses = createExpensesPageModel(page)
    const form = createExpenseFormPageModel(page)

    await page.goto(url().href)

    await login.email().locator.fill(credentials!.email)
    await login.password().locator.fill(credentials!.password)
    await login.logInButton().locator.click()

    await expect(expenses.heading().locator).toBeVisible()

    const description = `Coffee ${Date.now()}`

    await expenses.addButton().locator.click()
    await form.description().locator.fill(description)
    await form.amount().locator.fill('12.50')
    await form.category('אוכל').locator.check()
    await form.submitButton().locator.click()

    const item = expenses.list().item(description)

    await expect(item.locator).toContainText('12.50')
    await expect(expenses.summary().period('Day').current().locator).toContainText('12.50')

    // leave nothing behind: the e2e account is real and is reused by every run
    page.on('dialog', (dialog) => dialog.accept())
    await item.deleteButton().locator.click()

    await expect(item.locator).toHaveCount(0)
  })
})
