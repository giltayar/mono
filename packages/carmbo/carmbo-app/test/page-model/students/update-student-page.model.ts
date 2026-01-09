import type {Page} from '@playwright/test'
import {studentFormPageModel} from './student-form.model.ts'
import {createStudentHistoryPageModel} from './student-history.model.ts'
import {createAllPagesPageModel} from '../common/all-pages.model.ts'

export function createUpdateStudentPageModel(page: Page) {
  const tabsNav = page.locator('.nav-tabs')
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/students\/\d+$/,
    pageTitle: (locator = page.getByRole('heading', {name: /Update Student \d+/})) => ({locator}),
    tabs: () => ({
      detailsTab: (locator = tabsNav.getByRole('link', {name: 'Details'})) => ({locator}),
      salesTab: (locator = tabsNav.getByRole('link', {name: 'Sales'})) => ({locator}),
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

      ...studentFormPageModel(page),
    }),
    history: () => createStudentHistoryPageModel(page),
  }
}

export type UpdateStudentPageModel = ReturnType<typeof createUpdateStudentPageModel>
