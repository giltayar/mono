import type {Page} from '@playwright/test'
import {createJobListModel} from './job-list.model.ts'

export function createJobPageModel(page: Page) {
  return {
    urlRegex: /\/jobs\/\d+$/,
    pageTitle: (locator = page.locator('h2').first()) => ({
      locator,
      statusIndicator: (spanLocator = locator.locator('span.error')) => ({locator: spanLocator}),
    }),
    createdAt: (locator = page.locator('p', {hasText: 'Created:'})) => ({locator}),
    finishedAt: (locator = page.locator('p', {hasText: 'Finished:'})) => ({locator}),
    subjobsList: (locator = page.locator('table')) => createJobListModel(locator),
  }
}

export type JobPageModel = ReturnType<typeof createJobPageModel>
