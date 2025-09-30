import type {Page} from '@playwright/test'
import {productFormPageModel} from './product-form.model.ts'
import {createProductHistoryPageModel} from './product-history.model.ts'

export function createViewProductHistoryPageModel(page: Page) {
  return {
    urlRegex: /\/products\/\d+\/by-history\/[0-9a-f]+-/,
    pageTitle: (locator = page.getByRole('heading', {name: /View Product \d+ \(.*\)/})) => ({
      locator,
    }),
    form: () => productFormPageModel(page),
    history: () => createProductHistoryPageModel(page),
  }
}

export type ViewProductHistoryPageModel = ReturnType<typeof createViewProductHistoryPageModel>
