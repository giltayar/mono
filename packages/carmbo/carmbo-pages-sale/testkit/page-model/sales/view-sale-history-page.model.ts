import type {Page} from '@playwright/test'
import {saleFormPageModel} from './sale-form.model.ts'
import {createSaleHistoryPageModel} from './sale-history.model.ts'

export function createViewSaleHistoryPageModel(page: Page) {
  return {
    urlRegex: /\/sales\/\d+\/by-history\/[0-9a-f]+-/,
    pageTitle: (locator = page.getByRole('heading', {name: /View Sale \d+ \(.*\)/})) => ({
      locator,
    }),
    form: () => saleFormPageModel(page),
    history: () => createSaleHistoryPageModel(page),
  }
}

export type ViewSaleHistoryPageModel = ReturnType<typeof createViewSaleHistoryPageModel>
