import type {Page} from '@playwright/test'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'
import {communityFormPageModel} from './community-form.model.ts'

export function createNewCommunityPageModel(page: Page) {
  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/communities\/new$/,
    pageTitle: (locator = page.getByRole('heading', {name: /New Community/})) => ({locator}),
    form: () => ({
      createButton: (btnLocator = page.getByRole('button', {name: 'Create'})) => ({
        locator: btnLocator,
      }),
      discardButton: (btnLocator = page.getByRole('button', {name: 'Discard'})) => ({
        locator: btnLocator,
      }),
      ...communityFormPageModel(page),
    }),
  }
}

export type NewCommunityPageModel = ReturnType<typeof createNewCommunityPageModel>
