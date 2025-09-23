import type {Page, Locator} from '@playwright/test'

export function createStudentFormPageModel(page: Page) {
  return (locator = page.locator('form')) => ({
    locator,
    saveButton: (btnLocator = locator.getByRole('button', {name: 'Save'})) => ({
      locator: btnLocator,
    }),
    discardButton: (btnLocator = locator.getByRole('button', {name: 'Discard'})) => ({
      locator: btnLocator,
    }),
    names: (namesLocator = locator.getByRole('group', {name: 'Names', exact: true})) => ({
      locator: namesLocator,
      firstNameInput: (i: number) => ({
        locator: namesLocator.getByLabel(`First Name`).nth(i),
      }),
      lastNameInput: (i: number) => ({
        locator: namesLocator.getByLabel(`Last Name`).nth(i),
      }),
      ...addAndTrashButtons(namesLocator),
    }),
    emails: (emailsLocator = locator.getByRole('group', {name: 'Emails'})) => ({
      locator: emailsLocator,
      emailInput: (i: number) => ({
        locator: emailsLocator.getByLabel(`Email`).nth(i),
      }),
      ...addAndTrashButtons(emailsLocator),
    }),
    phones: (phonesLocator = locator.getByRole('group', {name: 'Phones'})) => ({
      locator: phonesLocator,
      phoneInput: (i: number) => ({
        locator: phonesLocator.getByLabel(`Phone`).nth(i),
      }),
      ...addAndTrashButtons(phonesLocator),
    }),
    facebookNames: (fbLocator = locator.getByRole('group', {name: 'Facebook names'})) => ({
      locator: fbLocator,
      facebookNameInput: (i: number) => ({
        locator: fbLocator.getByLabel(`Facebook Name`).nth(i),
      }),
      ...addAndTrashButtons(fbLocator),
    }),
    birthdayInput: (inputLocator = locator.getByLabel(`Birthday`)) => ({
      locator: inputLocator,
    }),
    cardcomCustomerIdInput: (inputLocator = locator.getByLabel('Cardcom Customer ID')) => ({
      locator: inputLocator,
    }),
  })
}

export type StudentFormPageModel = ReturnType<typeof createStudentFormPageModel>

function addAndTrashButtons(itemLocator: Locator) {
  return {
    addButton: (locator = itemLocator.getByRole('button', {name: 'Add'})) => ({
      locator,
    }),
    trashButton: (
      i: number,
      locator = itemLocator.getByRole('button', {name: 'Trash'}).nth(i),
    ) => ({
      locator,
    }),
  }
}
