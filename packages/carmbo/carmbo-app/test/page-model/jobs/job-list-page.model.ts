import type {Page} from '@playwright/test'
import {createJobListModel} from './job-list.model.ts'

export function createJobListPageModel(page: Page) {
  return {
    urlRegex: /\/jobs$/,
    pageTitle: (locator = page.locator('h2')) => ({locator}),
    list: (locator = page.locator('table')) => createJobListModel(locator),
  }
}

export type JobListPageModel = ReturnType<typeof createJobListPageModel>
