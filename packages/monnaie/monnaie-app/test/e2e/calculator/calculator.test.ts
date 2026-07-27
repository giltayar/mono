import {expect, test} from '@playwright/test'
import {firebaseCredentials, setup} from '../common/setup.ts'
import {createCalculatorPageModel} from '../../page-model/calculator/calculator-page.model.ts'
import {createLoginPageModel} from '../../page-model/login/login-page.model.ts'

const credentials = firebaseCredentials()

// The image talks to the real Firebase, so this needs a real project with a real user in it.
// Everything about authentication that can be tested against a fake is in `test/integration`.
test.describe(() => {
  test.skip(
    credentials === undefined,
    'needs MONNAIE_FIREBASE_API_KEY, MONNAIE_FIREBASE_SERVICE_ACCOUNT, MONNAIE_FIREBASE_TEST_EMAIL, MONNAIE_FIREBASE_TEST_PASSWORD',
  )

  const {url} = setup(() => credentials as NonNullable<typeof credentials>)

  test('logs in and calculates an expression', async ({page}) => {
    const login = createLoginPageModel(page)
    const calculator = createCalculatorPageModel(page)

    await page.goto(url().href)

    await expect(login.heading().locator).toBeVisible()

    await login.email().locator.fill(credentials?.email ?? '')
    await login.password().locator.fill(credentials?.password ?? '')
    await login.logInButton().locator.click()

    await expect(calculator.heading().locator).toBeVisible()

    await calculator.calculationInput().locator.fill('12 + 30')
    await calculator.calculateButton().locator.click()

    await expect(calculator.result().locator).toHaveText('= 42')
    await expect(calculator.history().items().locator).toHaveText([/12 \+ 30\s*= 42/])

    await calculator.history().deleteButton().locator.click()

    await expect(calculator.history().empty().locator).toBeVisible()
  })
})
