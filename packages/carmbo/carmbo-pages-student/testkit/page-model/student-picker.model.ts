import type {Page} from '@playwright/test'

export function createStudentPickerPageModel(page: Page) {
  const dialog = page.getByRole('dialog', {name: 'Search / create student', exact: true})
  const create = dialog.getByRole('form', {name: 'Create a student', exact: true})
  const labels = {
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    phone: 'Phone (optional)',
  }
  return {
    locator: dialog,
    search: () => ({
      locator: dialog.getByRole('searchbox', {name: 'Search students', exact: true}),
    }),
    results: () => ({
      locator: dialog.getByRole('list', {name: 'Student search results', exact: true}),
    }),
    select: (name: string) => ({
      locator: dialog.getByRole('button', {name: `Select ${name}`, exact: true}),
    }),
    create: () => ({
      open: () => ({locator: dialog.getByText('Create a student', {exact: true})}),
      input: (field: keyof typeof labels) => ({
        locator: create.getByRole('textbox', {name: labels[field], exact: true}),
      }),
      submit: () => ({
        locator: create.getByRole('button', {name: 'Create and select', exact: true}),
      }),
    }),
    cancel: () => ({locator: dialog.getByRole('button', {name: 'Cancel', exact: true})}),
  }
}
