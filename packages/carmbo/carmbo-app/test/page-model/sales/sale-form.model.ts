import type {Page} from '@playwright/test'

export function saleFormPageModel(page: Page, locator = page.locator('form')) {
  return {
    locator,
    salesEventInput: (inputLocator = locator.getByLabel('Sales Event')) => ({
      locator: inputLocator,
    }),
    studentInput: (inputLocator = locator.getByLabel('Student')) => ({
      locator: inputLocator,
    }),
    finalSaleRevenueInput: (inputLocator = locator.getByLabel('Final Sale Revenue')) => ({
      locator: inputLocator,
    }),
    cardcomInvoiceNumberInput: (inputLocator = locator.getByLabel('Cardcom Invoice Number')) => ({
      locator: inputLocator,
    }),
    products: (productsLocator = locator.getByRole('group', {name: 'Products'})) => ({
      locator: productsLocator,
      product: (index: number, productLocator = productsLocator.getByRole('group').nth(index)) => ({
        locator: productLocator,
        title: (titleLocator = productLocator.locator('legend h6')) => ({
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
  }
}

export type SaleFormPageModel = ReturnType<typeof saleFormPageModel>
