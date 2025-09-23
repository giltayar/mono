import type {Page} from '@playwright/test'
import {createStudentFormPageModel} from './student-form.model.ts'

export function createNewStudentPageModel(page: Page) {
  return {
    urlRegex: /\/students\/new$/,
    form: createStudentFormPageModel(page),
  }
}

export type NewStudentPageModel = ReturnType<typeof createNewStudentPageModel>
