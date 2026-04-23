import {test, expect} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {createProduct} from '../../../src/domain/product/model.ts'
import {createStudent} from '../../../src/domain/student/model.ts'
import {cancelSubscription} from '../common/cancel-subscription.ts'
import {createCancelSubscriptionPageModel} from '../../page-model/sales/cancel-subscription-page.model.ts'

const {url, sql, smooveIntegration} = setup(import.meta.url)

test.use({viewport: {width: 1280, height: 1280}})

test('cancel subscription shows error when email is not found', async ({page}) => {
  const productNumber = await createProduct(
    {
      name: 'Test Product',
      productType: 'club',
    },
    undefined,
    new Date(),
    sql(),
  )

  await cancelSubscription(page, url(), productNumber, 'nonexistent@example.com')

  const cancelSubscriptionPage = createCancelSubscriptionPageModel(page)
  await expect(cancelSubscriptionPage.errorMessage().locator).toContainText(
    'nonexistent@example.com',
  )
  await expect(cancelSubscriptionPage.errorMessage().locator).toContainText(
    'No subscription was found',
  )
})

test('cancel subscription shows error when student exists but has no subscription to this product', async ({
  page,
}) => {
  const productNumber = await createProduct(
    {
      name: 'Product Two',
      productType: 'club',
    },
    undefined,
    new Date(),
    sql(),
  )

  // Create a student (but no sale for product2)
  await createStudent(
    {
      names: [{firstName: 'Jane', lastName: 'Doe'}],
      emails: ['jane@example.com'],
      phones: [],
      facebookNames: [],
    },
    undefined,
    smooveIntegration(),
    new Date(),
    sql(),
  )

  await cancelSubscription(page, url(), productNumber, 'jane@example.com')

  const cancelSubscriptionPage = createCancelSubscriptionPageModel(page)
  await expect(cancelSubscriptionPage.errorMessage().locator).toContainText(
    'No subscription was found',
  )
  await expect(cancelSubscriptionPage.errorMessage().locator).toContainText('jane@example.com')
})
