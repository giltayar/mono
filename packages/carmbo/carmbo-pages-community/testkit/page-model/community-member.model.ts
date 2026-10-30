import type {Page} from '@playwright/test'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'

export function createCommunityMemberPageModel(page: Page) {
  const roles = page.getByRole('form', {name: 'Roles', exact: true})
  const actions = page.getByRole('form', {name: 'Membership actions', exact: true})
  const history = page.getByRole('list', {name: 'Membership history', exact: true})
  const state = page.getByRole('region', {name: 'Membership details', exact: true})
  const breadcrumb = page.getByRole('navigation', {name: 'Breadcrumb', exact: true})
  const items = history.getByRole('listitem')

  return {
    ...createAllPagesPageModel(page),
    urlRegex: /\/communities\/\d+\/members\/\d+$/,
    state: () => ({
      locator: state,
      labels: () => ({locator: state.getByRole('term')}),
      field: (name: string) => ({
        locator: state
          .getByRole('term')
          .and(state.getByText(name, {exact: true}))
          .locator('..')
          .getByRole('definition'),
      }),
      entryDate: () => ({
        locator: state
          .getByRole('term')
          .and(state.getByText('Date of entry', {exact: true}))
          .locator('..')
          .getByRole('time'),
      }),
      student: (name: string) => ({
        locator: state.getByRole('link', {name, exact: true}),
      }),
    }),
    breadcrumb: () => ({
      locator: breadcrumb,
      items: () => ({locator: breadcrumb.getByRole('listitem')}),
      current: () => ({locator: breadcrumb.getByRole('listitem').last()}),
      link: (name: string) => ({
        locator: breadcrumb.getByRole('link', {name, exact: true}),
      }),
    }),
    historical: () => ({locator: page.getByText('Read-only membership snapshot', {exact: true})}),
    current: () => ({
      locator: page.getByRole('link', {name: 'Current membership', exact: true}),
    }),
    error: () => ({locator: page.getByRole('alert')}),
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
      items: () => ({
        locator: items,
        dates: () => ({locator: items.getByRole('time')}),
        item: (index: number) => ({
          locator: items.nth(index),
          date: () => ({locator: items.nth(index).getByRole('time')}),
        }),
      }),
      link: (name: string) => ({
        locator: history.getByRole('link', {name, exact: true}),
      }),
    }),
  }
}

export function createCommunityMembersPageModel(page: Page) {
  const list = page.getByRole('table', {name: 'Community members', exact: true})
  const rows = list.getByRole('rowgroup').nth(1).getByRole('row')
  const tabs = page.getByRole('navigation', {name: 'Community navigation', exact: true})

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
      rows: () => ({
        locator: rows,
        row: (index: number) => ({locator: rows.nth(index)}),
        first: () => ({locator: rows.first()}),
        last: () => ({locator: rows.last()}),
      }),
      member: (name: string) => ({locator: list.getByRole('link', {name, exact: true})}),
      membership: (studentNumber: number) => ({
        locator: list.getByRole('button', {name: String(studentNumber), exact: true}),
      }),
    }),
    add: () => ({locator: page.getByRole('button', {name: 'Add member', exact: true})}),
  }
}
