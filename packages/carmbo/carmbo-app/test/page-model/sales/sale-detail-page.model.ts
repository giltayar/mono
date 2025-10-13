import type {Page} from '@playwright/test'

export function createSaleDetailPageModel(page: Page) {
  return {
    urlRegex: /\/sales\/\d+$/,
    saleNumberInput: (locator = page.getByLabel('Sale Number')) => ({
      locator,
    }),
    timestampInput: (locator = page.getByLabel('Timestamp')) => ({
      locator,
    }),
    salesEventInput: (locator = page.getByLabel('Sales Event')) => ({
      locator,
    }),
    studentInput: (locator = page.getByLabel('Student')) => ({
      locator,
    }),
    finalSaleRevenueInput: (locator = page.getByLabel('Final Sale Revenue')) => ({
      locator,
    }),
    cardcomInvoiceNumberInput: (locator = page.getByLabel('Cardcom Invoice Number')) => ({
      locator,
    }),
    products: (locator = page.locator('.card')) => ({
      locator,
      count: () => locator.count(),
      product: (index: number, productLocator = locator.nth(index)) => ({
        locator: productLocator,
        title: (titleLocator = productLocator.locator('.card-subtitle')) => ({
          locator: titleLocator,
        }),
        productNumber: (
          numberLocator = productLocator.locator('.col-md-4').nth(0).locator('div').last(),
        ) => ({
          locator: numberLocator,
        }),
        quantity: (
          quantityLocator = productLocator.locator('.col-md-4').nth(1).locator('div').last(),
        ) => ({
          locator: quantityLocator,
        }),
        unitPrice: (
          priceLocator = productLocator.locator('.col-md-4').nth(2).locator('div').last(),
        ) => ({
          locator: priceLocator,
        }),
      }),
    }),
  }
}

export type SaleDetailPageModel = ReturnType<typeof createSaleDetailPageModel>
