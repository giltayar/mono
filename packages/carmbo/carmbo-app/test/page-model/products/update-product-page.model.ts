import type {Page} from '@playwright/test'
import {productFormPageModel} from './product-form.model.ts'
import {createProductHistoryPageModel} from './product-history.model.ts'

export function createUpdateProductPageModel(page: Page) {
  return {
    urlRegex: /\/products\/\d+$/,
    pageTitle: (locator = page.getByRole('heading', {name: /Update Product \d+/})) => ({locator}),
    form: () => ({
      updateButton: (btnLocator = page.getByRole('button', {name: 'Update'})) => ({
        locator: btnLocator,
      }),
      discardButton: (btnLocator = page.getByRole('button', {name: 'Discard'})) => ({
        locator: btnLocator,
      }),
      deleteButton: (btnLocator = page.getByRole('button', {name: 'Archive'})) => ({
        locator: btnLocator,
      }),
      restoreButton: (btnLocator = page.getByRole('button', {name: 'Restore'})) => ({
        locator: btnLocator,
      }),

      ...productFormPageModel(page),
    }),
    history: () => createProductHistoryPageModel(page),
  }
}

export type UpdateProductPageModel = ReturnType<typeof createUpdateProductPageModel>
