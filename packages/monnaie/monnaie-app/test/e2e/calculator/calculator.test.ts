import {expect, test} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createCalculatorPageModel} from '../../page-model/calculator/calculator-page.model.ts'
import {createLoginPageModel} from '../../page-model/authentication/login-page.model.ts'
import {createUserBarPageModel} from '../../page-model/authentication/user-bar.model.ts'

const {url, testUser} = setup()

test('signs in and calculates an expression', async ({page}) => {
  await page.goto(url().href)

  // the only test that signs in through the identity provider for real: the integration tests fake
  // it, and can therefore never cover the client side of it
  const login = createLoginPageModel(page)

  await expect(login.heading().locator).toBeVisible()
  await login.emailInput().locator.fill(testUser.email)
  await login.passwordInput().locator.fill(testUser.password)
  await login.signInButton().locator.click()

  const calculator = createCalculatorPageModel(page)

  await expect(calculator.heading().locator).toBeVisible()
  await expect(createUserBarPageModel(page).email().locator).toHaveText(testUser.email)

  await calculator.calculationInput().locator.fill('12 + 30')
  await calculator.calculateButton().locator.click()

  await expect(calculator.result().locator).toHaveText('= 42')
  await expect(calculator.history().items().locator).toHaveText([/12 \+ 30\s*= 42/])

  await calculator.history().deleteButton().locator.click()

  await expect(calculator.history().empty().locator).toBeVisible()

  await createUserBarPageModel(page).signOutButton().locator.click()

  await expect(login.heading().locator).toBeVisible()
})
