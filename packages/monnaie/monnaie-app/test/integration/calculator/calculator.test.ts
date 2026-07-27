import {expect, test} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createCalculatorPageModel} from '../../page-model/calculator/calculator-page.model.ts'

const {url} = setup(import.meta.url, {signedInAs: 'alice@example.com'})

test('shows the calculator page', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await expect(calculator.heading().locator).toBeVisible()
  await expect(calculator.calculationInput().locator).toBeEmpty()
  await expect(calculator.result().locator).toBeEmpty()
  await expect(calculator.history().empty().locator).toBeVisible()
})

test('calculates an expression', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculationInput().locator.fill('12 + 30')
  await calculator.calculateButton().locator.click()

  await expect(calculator.result().locator).toHaveText('= 42')
  await expect(calculator.calculationInput().locator).toBeEmpty()
})

test('calculates a single number', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculationInput().locator.fill('42')
  await calculator.calculateButton().locator.click()

  await expect(calculator.result().locator).toHaveText('= 42')
})

test('shows an error for an expression with more than one operator', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculationInput().locator.fill('1 + 2 * 3')
  await calculator.calculateButton().locator.click()

  await expect(calculator.result().locator).toHaveText('Not a valid calculation')
})

test('shows an error for an invalid expression', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculationInput().locator.fill('1 +* 3')
  await calculator.calculateButton().locator.click()

  await expect(calculator.result().locator).toHaveText('Not a valid calculation')
  await expect(calculator.calculationInput().locator).toHaveValue('1 +* 3')
})

test('shows an error for an empty expression', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculateButton().locator.click()

  await expect(calculator.result().locator).toHaveText('Please enter a calculation')
})

test('adds correct calculations to the history, most recent first', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculationInput().locator.fill('12 + 30')
  await calculator.calculateButton().locator.click()

  await expect(calculator.history().items().locator).toHaveText([/12 \+ 30\s*= 42/])

  await calculator.calculationInput().locator.fill('6 * 7')
  await calculator.calculateButton().locator.click()

  await expect(calculator.history().items().locator).toHaveText([
    /6 \* 7\s*= 42/,
    /12 \+ 30\s*= 42/,
  ])
})

test('does not add incorrect calculations to the history', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculationInput().locator.fill('1 +* 3')
  await calculator.calculateButton().locator.click()

  await expect(calculator.result().locator).toHaveText('Not a valid calculation')
  await expect(calculator.history().empty().locator).toBeVisible()
})

test('deletes the history', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculationInput().locator.fill('12 + 30')
  await calculator.calculateButton().locator.click()

  await expect(calculator.history().items().locator).toHaveCount(1)

  await calculator.history().deleteButton().locator.click()

  await expect(calculator.history().empty().locator).toBeVisible()

  await page.reload()

  await expect(calculator.history().empty().locator).toBeVisible()
})

test('shows the history of previous calculations on load', async ({page}) => {
  await page.goto(url().href)
  const calculator = createCalculatorPageModel(page)

  await calculator.calculationInput().locator.fill('12 + 30')
  await calculator.calculateButton().locator.click()

  await expect(calculator.history().items().locator).toHaveCount(1)

  await page.reload()

  await expect(calculator.history().items().locator).toHaveText([/12 \+ 30\s*= 42/])
})
