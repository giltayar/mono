import type {Page} from '@playwright/test'

export function createCalculatorPageModel(page: Page) {
  return {
    heading: (locator = page.getByRole('heading', {name: 'Monnaie'})) => ({locator}),
    calculationInput: (locator = page.getByRole('textbox', {name: 'Calculation'})) => ({locator}),
    calculateButton: (locator = page.getByRole('button', {name: 'Calculate'})) => ({locator}),
    result: (locator = page.getByRole('status')) => ({locator}),
  }
}
