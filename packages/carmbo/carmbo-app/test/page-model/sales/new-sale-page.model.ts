import type {Page} from '@playwright/test'
import {saleFormPageModel} from './sale-form.model.ts'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'

export type NewSalePageModel = ReturnType<typeof createNewSalePageModel>

export function createNewSalePageModel(page: Page) {
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/sales\/new$/,
    pageTitle: (locator = page.getByRole('heading', {name: /New Sale/})) => ({locator}),
    form: () => ({
      createButton: (btnLocator = page.getByRole('button', {name: 'Create', exact: true})) => ({
        locator: btnLocator,
      }),
      discardButton: (btnLocator = page.getByRole('button', {name: 'Discard', exact: true})) => ({
        locator: btnLocator,
      }),

      ...saleFormPageModel(page),
    }),
  }
}
