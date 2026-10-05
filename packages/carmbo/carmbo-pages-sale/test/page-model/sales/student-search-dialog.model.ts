import type {Page} from '@playwright/test'

export function studentSearchDialogPageModel(page: Page) {
  const dialog = page.locator('#student-search-dialog')

  return {
    locator: dialog,
    searchInput: (inputLocator = dialog.getByLabel('Search')) => ({
      locator: inputLocator,
    }),
    results: (resultsLocator = dialog.locator('#student-search-results')) => ({
      locator: resultsLocator,
      items: (itemsLocator = resultsLocator.locator('.list-group-item')) => ({
        locator: itemsLocator,
        item: (index: number, itemLocator = itemsLocator.nth(index)) => ({
          locator: itemLocator,
          chooseButton: (btnLocator = itemLocator.getByRole('button', {name: 'Choose'})) => ({
            locator: btnLocator,
          }),
        }),
      }),
    }),
    createSection: (sectionLocator = dialog.locator('details')) => ({
      locator: sectionLocator,
      summary: (summaryLocator = sectionLocator.locator('summary')) => ({
        locator: summaryLocator,
      }),
      emailInput: (inputLocator = dialog.getByLabel('Email *')) => ({
        locator: inputLocator,
      }),
      firstNameInput: (inputLocator = dialog.getByLabel('First Name *')) => ({
        locator: inputLocator,
      }),
      lastNameInput: (inputLocator = dialog.getByLabel('Last Name *')) => ({
        locator: inputLocator,
      }),
      phoneInput: (inputLocator = dialog.getByLabel('Phone')) => ({
        locator: inputLocator,
      }),
      createAndChooseButton: (
        btnLocator = dialog.getByRole('button', {name: 'Create & Choose'}),
      ) => ({
        locator: btnLocator,
      }),
    }),
    cancelButton: (btnLocator = dialog.getByRole('button', {name: 'Cancel'})) => ({
      locator: btnLocator,
    }),
  }
}

export type StudentSearchDialogPageModel = ReturnType<typeof studentSearchDialogPageModel>
