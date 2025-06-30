import {describe, it} from 'node:test'
import assert from 'node:assert'
import {createFakeCardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/testkit'

describe('Cardcom Integration Testkit', () => {
  const testAccountId = 'test-account-123'
  const testProductId = 'test-product-456'
  const testRecurringPaymentId = 'recurring-789'
  const testProductName = 'Test Product'

  const createTestService = () => {
    return createFakeCardcomIntegrationService({
      accounts: {
        [testAccountId]: {
          recurringPayments: {
            [testProductId]: {
              recurringPaymentId: testRecurringPaymentId,
              name: testProductName,
              isActive: true,
            },
          },
          badPayments: {
            [testProductId]: [
              {
                date: new Date('2024-01-01'),
                badPaymentCount: 2,
              },
              {
                date: new Date('2024-02-01'),
                badPaymentCount: 0,
              },
              {
                date: new Date('2024-03-01'),
                badPaymentCount: 1,
              },
            ],
          },
        },
        'empty-account': {
          recurringPayments: {},
          badPayments: {},
        },
      },
    })
  }

  describe('enableDisableRecurringPayment', () => {
    it('should disable a recurring payment', async () => {
      const service = createTestService()

      const result = await service.enableDisableRecurringPayment(testRecurringPaymentId, 'disable')

      assert.strictEqual(result.ResponseCode, '0')
      assert.strictEqual(result.RecurringId, testRecurringPaymentId)
      assert.strictEqual(result.IsActive, 'false')

      // Verify the status changed
      const status = await service._test_getRecurringPaymentStatus(
        testAccountId,
        testRecurringPaymentId,
      )
      assert.strictEqual(status, false)
    })

    it('should enable a recurring payment', async () => {
      const service = createTestService()

      // First disable it
      await service.enableDisableRecurringPayment(testRecurringPaymentId, 'disable')

      // Then enable it
      const result = await service.enableDisableRecurringPayment(testRecurringPaymentId, 'enable')

      assert.strictEqual(result.ResponseCode, '0')
      assert.strictEqual(result.RecurringId, testRecurringPaymentId)
      assert.strictEqual(result.IsActive, 'true')

      // Verify the status changed
      const status = await service._test_getRecurringPaymentStatus(
        testAccountId,
        testRecurringPaymentId,
      )
      assert.strictEqual(status, true)
    })

    it('should throw error if recurring payment not found', async () => {
      const service = createTestService()
      const nonExistentRecurringPaymentId = 'non-existent-recurring-payment'

      await assert.rejects(
        () => service.enableDisableRecurringPayment(nonExistentRecurringPaymentId, 'disable'),
        /Recurring payment .* not found/,
      )
    })
  })

  describe('fetchRecurringPaymentInformation', () => {
    it('should return recurring payment information for existing account', async () => {
      const service = createTestService()

      const result = await service.fetchRecurringPaymentInformation(testAccountId, /Test Product/)

      assert.ok(result)
      assert.strictEqual(result.recurringPaymentId, testRecurringPaymentId)
    })
    it('should return undefined for existing account, but no such product', async () => {
      const service = createTestService()

      const result = await service.fetchRecurringPaymentInformation(testAccountId, /Thisnotexist/)

      assert.strictEqual(result, undefined)
    })

    it('should return undefined for non-existent account', async () => {
      const service = createTestService()

      const result = await service.fetchRecurringPaymentInformation(
        'non-existent-account',
        /Test Product/,
      )

      assert.strictEqual(result, undefined)
    })

    it('should return undefined for account with no recurring payments', async () => {
      const service = createTestService()

      const result = await service.fetchRecurringPaymentInformation('empty-account', /Test Product/)

      assert.strictEqual(result, undefined)
    })
  })

  describe('fetchRecurringPaymentBadPayments', () => {
    it('should return bad payments sorted by date', async () => {
      const service = createTestService()

      const result = await service.fetchRecurringPaymentBadPayments(testAccountId, testProductId)

      assert.ok(result)
      assert.strictEqual(result.length, 3)

      // Verify sorting by date (oldest first)
      assert.strictEqual(result[0].date.getTime(), new Date('2024-01-01').getTime())
      assert.strictEqual(result[0].badPaymentCount, 2)

      assert.strictEqual(result[1].date.getTime(), new Date('2024-02-01').getTime())
      assert.strictEqual(result[1].badPaymentCount, 0)

      assert.strictEqual(result[2].date.getTime(), new Date('2024-03-01').getTime())
      assert.strictEqual(result[2].badPaymentCount, 1)
    })

    it('should return undefined for non-existent account', async () => {
      const service = createTestService()

      const result = await service.fetchRecurringPaymentBadPayments(
        'non-existent-account',
        testProductId,
      )

      assert.strictEqual(result, undefined)
    })

    it('should return undefined for non-existent product', async () => {
      const service = createTestService()

      const result = await service.fetchRecurringPaymentBadPayments(
        testAccountId,
        'non-existent-product',
      )

      assert.strictEqual(result, undefined)
    })

    it('should return undefined for product with no bad payments', async () => {
      const service = createTestService()

      const result = await service.fetchRecurringPaymentBadPayments('empty-account', 'any-product')

      assert.strictEqual(result, undefined)
    })
  })

  describe('test helper methods', () => {
    describe('_test_getRecurringPaymentStatus', () => {
      it('should return the status of an existing recurring payment', async () => {
        const service = createTestService()

        const status = await service._test_getRecurringPaymentStatus(
          testAccountId,
          testRecurringPaymentId,
        )

        assert.strictEqual(status, true)
      })

      it('should return undefined for non-existent account', async () => {
        const service = createTestService()

        const status = await service._test_getRecurringPaymentStatus(
          'non-existent',
          testRecurringPaymentId,
        )

        assert.strictEqual(status, undefined)
      })

      it('should return undefined for non-existent recurring payment', async () => {
        const service = createTestService()

        const status = await service._test_getRecurringPaymentStatus(testAccountId, 'non-existent')

        assert.strictEqual(status, undefined)
      })
    })
  })
})
