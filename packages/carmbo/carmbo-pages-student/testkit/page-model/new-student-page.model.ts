import type {Page} from '@playwright/test'
import {studentFormPageModel} from './student-form.model.ts'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'

export function createNewStudentPageModel(page: Page) {
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/students\/new$/,
    pageTitle: (locator = page.getByRole('heading', {name: /New Student/})) => ({locator}),
    form: () => ({
      createButton: (btnLocator = page.getByRole('button', {name: 'Create'})) => ({
        locator: btnLocator,
      }),
      discardButton: (btnLocator = page.getByRole('button', {name: 'Discard'})) => ({
        locator: btnLocator,
      }),

      ...studentFormPageModel(page),
    }),
  }
}

export type NewStudentPageModel = ReturnType<typeof createNewStudentPageModel>
