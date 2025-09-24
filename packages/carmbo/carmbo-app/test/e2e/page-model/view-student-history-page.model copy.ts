import type {Page} from '@playwright/test'
import {createStudentFormPageModel} from './student-form.model.ts'
import {createStudentHistoryPageModel} from './student-history.model.ts'

export function createViewStudentHistoryPageModel(page: Page) {
  return {
    urlRegex: /\/students\/\d+\/by-history\/[0-9a-f]+-/,
    pageTitle: (locator = page.getByRole('heading', {name: /View Student \d+ \(.*\)/})) => ({
      locator,
    }),
    form: createStudentFormPageModel(page),
    history: () => createStudentHistoryPageModel(page),
  }
}

export type ViewStudentHistoryPageModel = ReturnType<typeof createViewStudentHistoryPageModel>
