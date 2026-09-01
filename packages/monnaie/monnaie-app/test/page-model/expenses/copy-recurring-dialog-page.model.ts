import type {Page} from '@playwright/test'

export function createCopyRecurringDialogPageModel(page: Page) {
  const dialog = page.getByRole('dialog', {name: 'Copy recurring expenses'})

  return {
    locator: dialog,
    selectAll: () => ({locator: dialog.getByRole('checkbox', {name: 'Select all'})}),
    expenses: () => ({locator: dialog.locator('.copy-recurring-options label')}),
    expense: (description: string) => ({
      locator: dialog
        .locator('.copy-recurring-options label')
        .filter({hasText: description})
        .getByRole('checkbox'),
    }),
    date: () => ({locator: dialog.getByLabel('Date')}),
    copyButton: () => ({locator: dialog.getByRole('button', {name: 'Copy', exact: true})}),
    cancelButton: () => ({locator: dialog.getByRole('button', {name: 'Cancel'})}),
  }
}
