import {expect, test} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createCalculatorPageModel} from '../../page-model/calculator/calculator-page.model.ts'

const {url} = setup()

test('shows the calculator page', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await expect(calculator.heading().locator).toBeVisible()
  await expect(calculator.calculationInput().locator).toBeEmpty()
  await expect(calculator.result().locator).toBeEmpty()
})

test('calculates an expression', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculationInput().locator.fill('1 + 2 * 3')
  await calculator.calculateButton().locator.click()

  await expect(calculator.result().locator).toHaveText('= 7')
})

test('shows an error for an invalid expression', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculationInput().locator.fill('1 +* 3')
  await calculator.calculateButton().locator.click()

  await expect(calculator.result().locator).toHaveText('Not a valid calculation')
})

test('shows an error for an empty expression', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculateButton().locator.click()

  await expect(calculator.result().locator).toHaveText('Please enter a calculation')
})
