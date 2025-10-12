import type {Page} from '@playwright/test'

export function createSaleDetailPageModel(page: Page) {
  return {
    urlRegex: /\/sales\/\d+$/,
    saleNumberInput: (locator = page.locator('label:has-text("Sale Number") + input').first()) => ({
      locator,
    }),
    timestampInput: (locator = page.locator('label:has-text("Timestamp") + input').first()) => ({
      locator,
    }),
    salesEventInput: (locator = page.locator('label:has-text("Sales Event") + input').first()) => ({
      locator,
    }),
    studentInput: (locator = page.locator('label:has-text("Student") + input').first()) => ({
      locator,
    }),
    finalSaleRevenueInput: (
      locator = page.locator('label:has-text("Final Sale Revenue") + input').first(),
    ) => ({
      locator,
    }),
    cardcomInvoiceNumberInput: (
      locator = page.locator('label:has-text("Cardcom Invoice Number") + input').first(),
    ) => ({
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
