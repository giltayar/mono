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
    mailingListProviderSelect: (selectLocator = locator.getByLabel('Mailing List Provider')) => ({
      locator: selectLocator,
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
    smooveRemovedDateCustomFieldInput: (
      inputLocator = locator.getByLabel('Removed Date Custom Field'),
    ) => ({
      locator: inputLocator,
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
    ravmesserListIdInput: (inputLocator = locator.getByLabel('RavMesser List ID')) => ({
      locator: inputLocator,
    }),
    ravmesserListIdCreateButton: (
      btnLocator = locator
        .locator('.row', {has: page.getByLabel('RavMesser List ID')})
        .getByRole('button', {name: 'Create'}),
    ) => ({
      locator: btnLocator,
    }),
    ravmesserCancelledListIdInput: (
      inputLocator = locator.getByLabel('RavMesser Cancelled Club List ID'),
    ) => ({
      locator: inputLocator,
    }),
    ravmesserRemovedListIdInput: (
      inputLocator = locator.getByLabel('RavMesser Removed List ID'),
    ) => ({
      locator: inputLocator,
    }),
    ravmesserRemovedListIdCreateButton: (
      btnLocator = locator
        .locator('.row', {has: page.getByLabel('RavMesser Removed List ID')})
        .getByRole('button', {name: 'Create'}),
    ) => ({
      locator: btnLocator,
    }),
    ravmesserRemovedDateCustomFieldInput: (
      inputLocator = locator.getByLabel('RavMesser Removed Date Custom Field'),
    ) => ({
      locator: inputLocator,
    }),
    ravmesserListCreateDialog: (dialogLocator = page.locator('#ravmesser-list-create-dialog')) => ({
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
