import type {Page} from '@playwright/test'

export function createNewCommunityMemberPageModel(page: Page) {
  const add = page.getByRole('form', {name: 'Add member', exact: true})
  const dialog = page.getByRole('dialog', {name: 'Search / create student', exact: true})
  const search = dialog.getByRole('search', {name: 'Search students', exact: true})
  const create = dialog.getByRole('form', {name: 'Create a student', exact: true})
  const fields = {
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    phone: 'Phone (optional)',
  }

  return {
    error: () => ({locator: page.getByRole('alert')}),
    cancel: () => ({
      locator: add.getByRole('link', {name: 'Cancel', exact: true}),
    }),
    student: () => ({locator: add.getByRole('textbox', {name: 'Student', exact: true})}),
    email: () => ({locator: add.getByRole('textbox', {name: 'Email', exact: true})}),
    roles: () => ({
      checkbox: (name: string) => ({
        locator: add
          .getByRole('group', {name: 'Roles', exact: true})
          .getByRole('checkbox', {name, exact: true}),
      }),
    }),
    submit: () => ({locator: add.getByRole('button', {name: 'Add member', exact: true})}),
    studentDialog: () => ({
      locator: dialog,
      open: () => ({
        locator: add.getByRole('button', {name: 'Search / create student', exact: true}),
      }),
      cancel: () => ({locator: dialog.getByRole('button', {name: 'Cancel', exact: true})}),
    }),
    search: () => ({
      noResults: () => ({locator: dialog.getByText('No students found', {exact: true})}),
      input: () => ({
        locator: search.getByRole('searchbox', {name: 'Search students', exact: true}),
      }),
      submit: () => ({locator: search.getByRole('button', {name: 'Search students', exact: true})}),
      select: (name: string) => ({
        locator: dialog
          .getByRole('list', {name: 'Student search results', exact: true})
          .getByRole('button', {name: `Select ${name}`, exact: true}),
      }),
    }),
    create: () => ({
      open: () => ({locator: dialog.getByText('Create a student', {exact: true})}),
      input: (name: 'firstName' | 'lastName' | 'email' | 'phone') => ({
        locator: create.getByRole('textbox', {name: fields[name], exact: true}),
      }),
      submit: () => ({locator: create.getByRole('button')}),
    }),
  }
}
