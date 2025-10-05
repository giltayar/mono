import type {Page} from '@playwright/test'
import {salesEventFormPageModel} from './sales-event-form.model.ts'

export function createNewSalesEventPageModel(page: Page) {
  return {
    urlRegex: /\/sales-events\/new$/,
    pageTitle: (locator = page.getByRole('heading', {name: /New Sales Event/})) => ({locator}),
    form: () => ({
      createButton: (btnLocator = page.getByRole('button', {name: 'Create'})) => ({
        locator: btnLocator,
      }),
      discardButton: (btnLocator = page.getByRole('button', {name: 'Discard'})) => ({
        locator: btnLocator,
      }),

      ...salesEventFormPageModel(page),
    }),
  }
}

export type NewSalesEventPageModel = ReturnType<typeof createNewSalesEventPageModel>
