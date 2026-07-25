import {expect, test} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createCalculatorPageModel} from '../../page-model/calculator/calculator-page.model.ts'

const {url} = setup()

test('calculates an expression', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await expect(calculator.heading().locator).toBeVisible()

  await calculator.calculationInput().locator.fill('12 + 30')
  await calculator.calculateButton().locator.click()

  await expect(calculator.result().locator).toHaveText('= 42')
})
