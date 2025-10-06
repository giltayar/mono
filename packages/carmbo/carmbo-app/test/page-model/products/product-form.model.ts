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
    smooveCancellingListIdInput: (
      inputLocator = locator.getByLabel('Smoove Cancelling List ID'),
    ) => ({
      locator: inputLocator,
    }),
    smooveCancelledListIdInput: (
      inputLocator = locator.getByLabel('Smoove Cancelled List ID'),
    ) => ({
      locator: inputLocator,
    }),
    smooveRemovedListIdInput: (inputLocator = locator.getByLabel('Smoove Removed List ID')) => ({
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
