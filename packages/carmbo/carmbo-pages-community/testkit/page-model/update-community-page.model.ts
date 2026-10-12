import type {Page} from '@playwright/test'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'
import {communityFormPageModel} from './community-form.model.ts'
import {createCommunityHistoryPageModel} from './community-history.model.ts'

export function createUpdateCommunityPageModel(page: Page) {
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/communities\/\d+$/,
    pageTitle: (locator = page.getByRole('heading', {name: /Update Community \d+/})) => ({
      locator,
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
      ...communityFormPageModel(page),
    }),
    history: () => createCommunityHistoryPageModel(page),
  }
}

export type UpdateCommunityPageModel = ReturnType<typeof createUpdateCommunityPageModel>
