import type {Page} from '@playwright/test'
import {communityFormPageModel} from './community-form.model.ts'
import {createCommunityHistoryPageModel} from './community-history.model.ts'

export function createViewCommunityHistoryPageModel(page: Page) {
  return {
    urlRegex: /\/communities\/\d+\/by-history\/[0-9a-f]+-/,
    pageTitle: (locator = page.getByRole('heading', {name: /View Community \d+ \(.*\)/})) => ({
      locator,
    }),
    form: () => communityFormPageModel(page),
    history: () => createCommunityHistoryPageModel(page),
  }
}

export type ViewCommunityHistoryPageModel = ReturnType<typeof createViewCommunityHistoryPageModel>
