import type {Page} from '@playwright/test'

export function createCancelSubscriptionPageModel(page: Page) {
  return {
    form: (formLocator = page.locator('#cancel-subscription-form')) => ({
      locator: formLocator,
      emailInput: (locator = formLocator.getByLabel('Email')) => ({locator}),
      submitButton: (locator = formLocator.getByRole('button', {name: 'Cancel Subscription'})) => ({
        locator,
      }),
    }),
    confirmDialog: (dialogLocator = page.locator('#confirm-dialog')) => ({
      locator: dialogLocator,
      confirmButton: (locator = dialogLocator.locator('#confirm-yes')) => ({locator}),
      cancelButton: (locator = dialogLocator.locator('#confirm-no')) => ({locator}),
    }),
    errorMessage: (locator = page.locator('.card-body p')) => ({locator}),
  }
}
