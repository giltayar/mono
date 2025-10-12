import type {Page} from '@playwright/test'
import {salesEventFormPageModel} from './sales-event-form.model.ts'
import {createSalesEventHistoryPageModel} from './sales-event-history.model.ts'

export function createUpdateSalesEventPageModel(page: Page) {
  return {
    urlRegex: /\/sales-events\/\d+$/,
    pageTitle: (locator = page.getByRole('heading', {name: /Update Sales Event \d+/})) => ({
      locator,
    }),
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

      ...salesEventFormPageModel(page),
    }),
    cardcomInformation: () => ({
      webhookUrlInput: (inputLocator = page.getByLabel('CardCom Webhook URL')) => ({
        locator: inputLocator,
      }),
    }),
    history: () => createSalesEventHistoryPageModel(page),
  }
}

export type UpdateSalesEventPageModel = ReturnType<typeof createUpdateSalesEventPageModel>
