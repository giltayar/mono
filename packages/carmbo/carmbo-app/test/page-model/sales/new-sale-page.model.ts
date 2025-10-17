import type {Page} from '@playwright/test'
import {saleFormPageModel} from './sale-form.model.ts'
import {createAllPagesPageModel} from '../common/all-pages.model.ts'

export type NewSalePageModel = ReturnType<typeof createNewSalePageModel>

export function createNewSalePageModel(page: Page) {
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/sales\/new$/,
    pageTitle: (locator = page.getByRole('heading', {name: /New Sale/})) => ({locator}),
    form: () => ({
      createButton: (btnLocator = page.getByRole('button', {name: 'Create'})) => ({
        locator: btnLocator,
      }),
      discardButton: (btnLocator = page.getByRole('button', {name: 'Discard'})) => ({
        locator: btnLocator,
      }),

      ...saleFormPageModel(page),
    }),
  }
}
