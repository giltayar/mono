import type {Page} from '@playwright/test'

export function communityFormPageModel(page: Page, locator = page.locator('form')) {
  return {
    locator,
    nameInput: (inputLocator = locator.getByLabel('Name')) => ({locator: inputLocator}),
    descriptionInput: (inputLocator = locator.getByLabel('Description')) => ({
      locator: inputLocator,
    }),
  }
}

export type CommunityFormPageModel = ReturnType<typeof communityFormPageModel>
