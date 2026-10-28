import type {Page} from '@playwright/test'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'

export function createCommunityMemberPageModel(page: Page) {
  const roles = page.getByRole('form', {name: 'Roles', exact: true})
  const actions = page.getByRole('form', {name: 'Membership actions', exact: true})
  const history = page.getByRole('list', {name: 'Membership history', exact: true})

  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/communities\/\d+\/members\/\d+$/,
    state: () => ({locator: page.getByRole('region', {name: 'Membership details', exact: true})}),
    roles: () => ({
      locator: roles,
      checkbox: (name: string) => ({locator: roles.getByRole('checkbox', {name, exact: true})}),
      save: () => ({locator: roles.getByRole('button')}),
    }),
    actions: () => ({
      locator: actions,
      reason: () => ({
        locator: actions.getByRole('textbox', {name: 'Reason (optional)', exact: true}),
      }),
      button: (name: string) => ({locator: actions.getByRole('button', {name, exact: true})}),
    }),
    history: () => ({
      locator: history,
      items: () => ({locator: history.getByRole('listitem')}),
      link: (name: string) => ({
        locator: history.getByRole('link', {name, exact: true}),
      }),
    }),
  }
}

export function createCommunityMembersPageModel(page: Page) {
  const list = page.getByRole('table', {name: 'Community members', exact: true})
  const create = page.getByRole('form', {name: 'Create a student', exact: true})
  const tabs = page.getByRole('navigation', {name: 'Community navigation', exact: true})
  const search = page.getByRole('search', {name: 'Search students', exact: true})
  const add = page.getByRole('form', {name: 'Add member', exact: true})
  const dialog = page.getByRole('dialog', {name: 'Search / create student', exact: true})
  const fields = {
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    phone: 'Phone (optional)',
  }

  return {
    tabs: () => ({
      details: () => ({
        locator: tabs.getByRole('link', {name: 'Details', exact: true}),
      }),
      members: () => ({
        locator: tabs.getByRole('link', {name: 'Members', exact: true}),
      }),
    }),
    filter: () => ({
      locator: page
        .getByRole('search', {name: 'Community members', exact: true})
        .getByRole('searchbox', {name: 'Search:', exact: true}),
    }),
    list: () => ({
      locator: list,
      rows: () => ({locator: list.getByRole('rowgroup').nth(1).getByRole('row')}),
      member: (name: string) => ({locator: list.getByRole('link', {name, exact: true})}),
      membership: (studentNumber: number) => ({
        locator: list.getByRole('button', {name: String(studentNumber), exact: true}),
      }),
    }),
    add: () => ({locator: page.getByRole('button', {name: 'Add member', exact: true})}),
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
    dialog: () => ({
      locator: dialog,
      open: () => ({
        locator: add.getByRole('button', {name: 'Search / create student', exact: true}),
      }),
      cancel: () => ({locator: dialog.getByRole('button', {name: 'Cancel', exact: true})}),
    }),
    search: () => ({
      input: () => ({
        locator: search.getByRole('searchbox', {name: 'Search students', exact: true}),
      }),
      submit: () => ({locator: search.getByRole('button', {name: 'Search students', exact: true})}),
      select: (name: string) => ({
        locator: page
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
