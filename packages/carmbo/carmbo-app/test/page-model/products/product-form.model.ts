import type {Page, Locator} from '@playwright/test'

export function productFormPageModel(page: Page, locator = page.locator('form')) {
  return {
    locator,
    nameInput: (inputLocator = locator.getByLabel('Product Name')) => ({
      locator: inputLocator,
    }),
    productTypeSelect: (selectLocator = locator.getByLabel('Product Type')) => ({
      locator: selectLocator,
    }),
    academyCourses: (
      coursesLocator = locator.getByRole('group', {name: 'Academy Courses', exact: true}),
    ) => ({
      locator: coursesLocator,
      subdomainSelect: (i: number) => ({
        locator: coursesLocator.getByLabel(`Academy Account`).nth(i),
      }),
      academyCourseInput: (i: number) => ({
        locator: coursesLocator.getByLabel(`Academy Course ID`).nth(i),
      }),
      ...addAndTrashButtons(coursesLocator),
    }),
    whatsappGroups: (
      whatsappLocator = locator.getByRole('group', {name: 'WhatsApp Groups', exact: true}),
    ) => ({
      locator: whatsappLocator,
      whatsappGroupInput: (i: number) => ({
        locator: whatsappLocator.getByLabel(`WhatsApp Group ID`).nth(i),
      }),
      whatsappGroupGoogleSheetUrlInput: (i: number) => ({
        locator: whatsappLocator.getByLabel(`Messages Google Sheet URL`).nth(i),
      }),
      ...addAndTrashButtons(whatsappLocator),
    }),
    facebookGroups: (
      facebookLocator = locator.getByRole('group', {name: 'Facebook Groups', exact: true}),
    ) => ({
      locator: facebookLocator,
      facebookGroupInput: (i: number) => ({
        locator: facebookLocator.getByLabel(`Facebook Group ID`).nth(i),
      }),
      ...addAndTrashButtons(facebookLocator),
    }),
    smooveListIdInput: (inputLocator = locator.getByLabel('Smoove List ID')) => ({
      locator: inputLocator,
    }),
    smooveListIdCreateButton: (
      btnLocator = locator
        .locator('.row', {has: page.getByLabel('Smoove List ID')})
        .getByRole('button', {name: 'Create'}),
    ) => ({
      locator: btnLocator,
    }),
    smooveCancelledListIdInput: (
      inputLocator = locator.getByLabel('Smoove Cancelled Club List ID'),
    ) => ({
      locator: inputLocator,
    }),
    smooveCancelledListIdCreateButton: (
      btnLocator = locator
        .locator('.row', {has: page.getByLabel('Smoove Cancelled List ID')})
        .getByRole('button', {name: 'Create'}),
    ) => ({
      locator: btnLocator,
    }),
    smooveRemovedListIdInput: (inputLocator = locator.getByLabel('Smoove Removed List ID')) => ({
      locator: inputLocator,
    }),
    smooveRemovedListIdCreateButton: (
      btnLocator = locator
        .locator('.row', {has: page.getByLabel('Smoove Removed List ID')})
        .getByRole('button', {name: 'Create'}),
    ) => ({
      locator: btnLocator,
    }),
    smooveListCreateDialog: (dialogLocator = page.locator('#smoove-list-create-dialog')) => ({
      locator: dialogLocator,
      listNameInput: (inputLocator = dialogLocator.getByLabel('List Name')) => ({
        locator: inputLocator,
      }),
      createButton: (btnLocator = dialogLocator.getByRole('button', {name: 'Create'})) => ({
        locator: btnLocator,
      }),
      cancelButton: (btnLocator = dialogLocator.getByRole('button', {name: 'Cancel'})) => ({
        locator: btnLocator,
      }),
    }),
    notesInput: (inputLocator = locator.getByLabel('Notes')) => ({
      locator: inputLocator,
    }),
    sendSkoolInvitationCheckbox: (inputLocator = locator.getByLabel('Send Skool Invitation')) => ({
      locator: inputLocator,
    }),
  }
}

export type ProductFormPageModel = ReturnType<typeof productFormPageModel>

function addAndTrashButtons(itemLocator: Locator) {
  return {
    addButton: (locator = itemLocator.getByRole('button', {name: 'Add'})) => ({
      locator,
    }),
    trashButton: (
      i: number,
      locator = itemLocator.getByRole('button', {name: 'Remove'}).nth(i),
    ) => ({
      locator,
    }),
  }
}
