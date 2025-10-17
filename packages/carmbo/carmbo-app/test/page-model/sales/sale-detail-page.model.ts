import type {Page} from '@playwright/test'

export function createSaleDetailPageModel(page: Page) {
  return {
    urlRegex: /\/sales\/\d+$/,
    form: (formLocator = page.locator('form')) => ({
      locator: formLocator,
      studentInput: (locator = formLocator.getByLabel('Student')) => ({
        locator,
      }),
      salesEventInput: (locator = formLocator.getByLabel('Sales Event')) => ({
        locator,
      }),
      finalSaleRevenueInput: (locator = formLocator.getByLabel('Final Sale Revenue')) => ({
        locator,
      }),
      cardcomInvoiceNumberInput: (locator = formLocator.getByLabel('Cardcom Invoice Number')) => ({
        locator,
      }),
      products: (
        locator = formLocator.getByRole('group', {name: 'Products'}).getByRole('group'),
      ) => ({
        locator,
        product: (index: number, productLocator = locator.nth(index)) => ({
          locator: productLocator,
          title: (titleLocator = productLocator.locator('legend')) => ({
            locator: titleLocator,
          }),
          quantity: (quantityLocator = productLocator.getByLabel('Quantity')) => ({
            locator: quantityLocator,
          }),
          unitPrice: (priceLocator = productLocator.getByLabel('Unit Price')) => ({
            locator: priceLocator,
          }),
        }),
      }),
    }),
  }
}

export type SaleDetailformLocatorModel = ReturnType<typeof createSaleDetailPageModel>
