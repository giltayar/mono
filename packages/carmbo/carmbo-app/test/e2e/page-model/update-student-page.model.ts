import type {Page} from '@playwright/test'
import {createStudentFormPageModel} from './student-form.model.ts'
import {createStudentHistoryPageModel} from './student-history.model.ts'

export function createUpdateStudentPageModel(page: Page) {
  return {
    urlRegex: /\/students\/\d+$/,
    pageTitle: (locator = page.getByRole('heading', {name: /Update Student \d+/})) => ({locator}),
    form: createStudentFormPageModel(page),
    history: () => createStudentHistoryPageModel(page),
  }
}

export type UpdateStudentPageModel = ReturnType<typeof createUpdateStudentPageModel>
