import type {Page} from '@playwright/test'

export function createCalculatorPageModel(page: Page) {
  return {
    heading: (locator = page.getByRole('heading', {name: 'Monnaie'})) => ({locator}),
    calculationInput: (locator = page.getByRole('textbox', {name: 'Calculation'})) => ({locator}),
    calculateButton: (locator = page.getByRole('button', {name: 'Calculate'})) => ({locator}),
    result: (locator = page.getByRole('status')) => ({locator}),
    history: (locator = page.getByRole('region', {name: 'History'})) => ({
      locator,
      items: () => ({locator: locator.getByRole('listitem')}),
      empty: () => ({locator: locator.getByText('No calculations yet')}),
      deleteButton: () => ({locator: locator.getByRole('button', {name: 'Delete history'})}),
    }),
  }
}
