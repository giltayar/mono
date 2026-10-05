import type {Page} from '@playwright/test'
import {productFormPageModel} from './product-form.model.ts'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'

export function createNewProductPageModel(page: Page) {
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/products\/new$/,
    pageTitle: (locator = page.getByRole('heading', {name: /New Product/})) => ({locator}),
    form: () => ({
      createButton: (
        btnLocator = page.getByLabel('Form actions').getByRole('button', {name: 'Create'}),
      ) => ({
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
