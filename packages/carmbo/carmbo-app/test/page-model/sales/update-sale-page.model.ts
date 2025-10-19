import type {Page} from '@playwright/test'
import {saleFormPageModel} from './sale-form.model.ts'
import {createSaleHistoryPageModel} from './sale-history.model.ts'
import {createAllPagesPageModel} from '../common/all-pages.model.ts'

export function createUpdateSalePageModel(page: Page) {
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/sales\/\d+$/,
    pageTitle: (locator = page.getByRole('heading', {level: 2})) => ({locator}),
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
      connectButton: (btnLocator = page.getByRole('button', {name: 'Connect'})) => ({
        locator: btnLocator,
      }),

      ...saleFormPageModel(page),
    }),
    history: () => createSaleHistoryPageModel(page),
  }
}

export type UpdateSalePageModel = ReturnType<typeof createUpdateSalePageModel>
