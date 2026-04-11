import type {Page} from '@playwright/test'
import {createCancelSubscriptionPageModel} from '../../page-model/sales/cancel-subscription-page.model.ts'

export async function cancelSubscription(
  page: Page,
  baseUrl: URL,
  productNumber: number,
  email: string,
) {
  const cancelSubscriptionPage = createCancelSubscriptionPageModel(page)

  await page.goto(
    new URL(`/landing-page/sales/cancel-subscription/product/${productNumber}`, baseUrl).href,
  )

  await cancelSubscriptionPage.form().emailInput().locator.fill(email)
  await cancelSubscriptionPage.form().submitButton().locator.click()
  await cancelSubscriptionPage.confirmDialog().confirmButton().locator.click()
}
