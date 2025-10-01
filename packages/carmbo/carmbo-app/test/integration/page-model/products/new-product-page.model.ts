import type {Page} from '@playwright/test'
import {productFormPageModel} from './product-form.model.ts'

export function createNewProductPageModel(page: Page) {
  return {
    urlRegex: /\/products\/new$/,
    pageTitle: (locator = page.getByRole('heading', {name: /New Product/})) => ({locator}),
    form: () => ({
      createButton: (btnLocator = page.getByRole('button', {name: 'Create'})) => ({
        locator: btnLocator,
      }),
      discardButton: (btnLocator = page.getByRole('button', {name: 'Discard'})) => ({
        locator: btnLocator,
      }),

      ...productFormPageModel(page),
    }),
  }
}

export type NewProductPageModel = ReturnType<typeof createNewProductPageModel>
