import type {Page, Locator} from '@playwright/test'

export function salesEventFormPageModel(page: Page, locator = page.locator('form')) {
  return {
    locator,
    nameInput: (inputLocator = locator.getByLabel('Sales Event Name')) => ({
      locator: inputLocator,
    }),
    fromDateInput: (inputLocator = locator.getByLabel('From Date')) => ({
      locator: inputLocator,
    }),
    toDateInput: (inputLocator = locator.getByLabel('To Date')) => ({
      locator: inputLocator,
    }),
    landingPageUrlInput: (inputLocator = locator.getByLabel('Landing Page URL')) => ({
      locator: inputLocator,
    }),
    productsForSale: (
      productsLocator = locator.getByRole('group', {name: 'Products for Sale', exact: true}),
    ) => ({
      locator: productsLocator,
      productInput: (i: number) => ({
        locator: productsLocator.getByLabel(`Product For Sale`).nth(i),
      }),
      ...addAndTrashButtons(productsLocator),
    }),
  }
}

export type SalesEventFormPageModel = ReturnType<typeof salesEventFormPageModel>

function addAndTrashButtons(itemLocator: Locator) {
  return {
    addButton: (locator = itemLocator.getByRole('button', {name: 'Add'})) => ({
      locator,
    }),
    trashButton: (
      i: number,
      locator = itemLocator.getByRole('button', {name: 'Remove'}).nth(i),
    ) => ({
      locator,
    }),
  }
}
