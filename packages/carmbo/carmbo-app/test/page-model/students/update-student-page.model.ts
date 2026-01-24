import type {Page} from '@playwright/test'
import {studentFormPageModel} from './student-form.model.ts'
import {createStudentHistoryPageModel} from './student-history.model.ts'
import {createAllPagesPageModel} from '../common/all-pages.model.ts'

export function createUpdateStudentPageModel(page: Page) {
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/students\/\d+$/,
    pageTitle: (locator = page.getByRole('heading', {name: /Update Student \d+/})) => ({locator}),
    magicLink: (magicLinkSection = page.getByLabel('Academy Magic Link')) => ({
      fetchButton: (locator = magicLinkSection.getByRole('button', {name: 'Fetch link'})) => ({
        locator,
      }),
      noLinksMessage: (
        locator = magicLinkSection.locator('p:has-text("No magic links found")'),
      ) => ({
        locator,
      }),
      singleLink: (locator = magicLinkSection.locator('a')) => ({locator}),
      linksList: (locator = magicLinkSection.locator('ul')) => ({
        locator,
        items: (itemsLocator = locator.locator('li')) => ({
          locator: itemsLocator,
          item: (i: number, itemLocator = itemsLocator.nth(i)) => ({
            locator: itemLocator,
            link: (linkLocator = itemLocator.locator('a')) => ({locator: linkLocator}),
          }),
        }),
      }),
    }),
    tabs: (tabsNav = page.locator('.nav-tabs')) => ({
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
