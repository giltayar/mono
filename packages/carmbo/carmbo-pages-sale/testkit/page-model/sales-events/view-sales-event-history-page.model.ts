import type {Page} from '@playwright/test'
import {salesEventFormPageModel} from './sales-event-form.model.ts'
import {createSalesEventHistoryPageModel} from './sales-event-history.model.ts'

export function createViewSalesEventHistoryPageModel(page: Page) {
  return {
    urlRegex: /\/sales-events\/\d+\/by-history\/[0-9a-f]+-/,
    pageTitle: (locator = page.getByRole('heading', {name: /View Sales Event \d+ \(.*\)/})) => ({
      locator,
    }),
    form: () => salesEventFormPageModel(page),
    history: () => createSalesEventHistoryPageModel(page),
  }
}

export type ViewSalesEventHistoryPageModel = ReturnType<typeof createViewSalesEventHistoryPageModel>
