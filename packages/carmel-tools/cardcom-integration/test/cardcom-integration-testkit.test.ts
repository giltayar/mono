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

      const result = await service.fetchRecurringPaymentBadPayments(testAccountId, [testProductId])

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

      const result = await service.fetchRecurringPaymentBadPayments('non-existent-account', [
        testProductId,
      ])

      assert.strictEqual(result, undefined)
    })

    it('should return undefined for non-existent product', async () => {
      const service = createTestService()

      const result = await service.fetchRecurringPaymentBadPayments(testAccountId, [
        'non-existent-product',
      ])

      assert.strictEqual(result, undefined)
    })

    it('should return undefined for product with no bad payments', async () => {
      const service = createTestService()

      const result = await service.fetchRecurringPaymentBadPayments('empty-account', [
        'any-product',
      ])

      assert.strictEqual(result, undefined)
    })
  })

  describe('createTaxInvoiceDocument', () => {
    it('should create a tax invoice document with customer ID', async () => {
      const service = createTestService()

      const invoiceInformation = {
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        customerPhone: '050-1234567',
        cardcomCustomerId: 12345,
        productsSold: [
          {
            productId: 'prod-1',
            productName: 'Product One',
            quantity: 2,
            unitPriceInCents: 5000,
          },
          {
            productId: 'prod-2',
            productName: 'Product Two',
            quantity: 1,
            unitPriceInCents: 10000,
          },
        ],
        transactionDate: new Date('2024-06-15'),
        transactionDescription: 'Test transaction',
        transactionRevenueInCents: 1100,
      }

      const result = await service.createTaxInvoiceDocument(invoiceInformation, {
        sendInvoiceByMail: true,
      })

      assert.ok(result)
      assert.strictEqual(result.cardcomInvoiceNumber, 1)
      assert.strictEqual(result.cardcomDocumentLink, 'http://invoice-document.example.com/1')
      assert.strictEqual(result.cardcomCustomerId, '12345')

      // Verify the invoice information was stored correctly
      const storedInvoice = await service._test_getTaxInvoiceDocument('1')
      assert.ok(storedInvoice)
      assert.strictEqual(storedInvoice.customerName, 'John Doe')
      assert.strictEqual(storedInvoice.customerEmail, 'john@example.com')
      assert.strictEqual(storedInvoice.customerPhone, '050-1234567')
      assert.strictEqual(storedInvoice.cardcomCustomerId, 12345)
      assert.strictEqual(storedInvoice.productsSold.length, 2)
      assert.strictEqual(storedInvoice.productsSold[0].productId, 'prod-1')
      assert.strictEqual(storedInvoice.productsSold[0].productName, 'Product One')
      assert.strictEqual(storedInvoice.productsSold[0].quantity, 2)
      assert.strictEqual(storedInvoice.productsSold[0].unitPriceInCents, 5000)
      assert.strictEqual(storedInvoice.productsSold[1].productId, 'prod-2')
      assert.strictEqual(storedInvoice.transactionDate.getTime(), new Date('2024-06-15').getTime())
    })

    it('should create a tax invoice document without customer ID', async () => {
      const service = createTestService()

      const invoiceInformation = {
        customerName: 'Jane Smith',
        customerEmail: 'jane@example.com',
        customerPhone: undefined,
        cardcomCustomerId: undefined,
        productsSold: [
          {
            productId: 'prod-3',
            productName: 'Product Three',
            quantity: 1,
            unitPriceInCents: 7500,
          },
        ],
        transactionDate: new Date('2024-07-01'),
        transactionDescription: undefined,
        transactionRevenueInCents: 1100,
      }

      const result = await service.createTaxInvoiceDocument(invoiceInformation, {
        sendInvoiceByMail: false,
      })

      assert.ok(result)
      assert.strictEqual(result.cardcomInvoiceNumber, 1)
      assert.strictEqual(result.cardcomDocumentLink, 'http://invoice-document.example.com/1')
      // Should generate a random customer ID
      assert.ok(result.cardcomCustomerId)
      assert.ok(parseInt(result.cardcomCustomerId) >= 0)

      // Verify the invoice information was stored correctly
      const storedInvoice = await service._test_getTaxInvoiceDocument('1')
      assert.ok(storedInvoice)
      assert.strictEqual(storedInvoice.customerName, 'Jane Smith')
      assert.strictEqual(storedInvoice.customerEmail, 'jane@example.com')
      assert.strictEqual(storedInvoice.customerPhone, undefined)
      // The stored invoice should have the generated customer ID
      assert.strictEqual(storedInvoice.cardcomCustomerId, parseInt(result.cardcomCustomerId))
      assert.strictEqual(storedInvoice.productsSold.length, 1)
      assert.strictEqual(storedInvoice.productsSold[0].productId, 'prod-3')
      assert.strictEqual(storedInvoice.productsSold[0].productName, 'Product Three')
      assert.strictEqual(storedInvoice.productsSold[0].quantity, 1)
      assert.strictEqual(storedInvoice.productsSold[0].unitPriceInCents, 7500)
      assert.strictEqual(storedInvoice.transactionDate.getTime(), new Date('2024-07-01').getTime())
    })

    it('should increment invoice numbers for multiple documents', async () => {
      const service = createTestService()

      const invoiceInformation1 = {
        customerName: 'Customer One',
        customerEmail: 'one@example.com',
        customerPhone: undefined,
        cardcomCustomerId: 11111,
        productsSold: [
          {
            productId: 'prod-1',
            productName: 'Product',
            quantity: 1,
            unitPriceInCents: 1000,
          },
        ],
        transactionDate: new Date('2024-08-01'),
        transactionDescription: 'First invoice',
        transactionRevenueInCents: 1100,
      }

      const invoiceInformation2 = {
        customerName: 'Customer Two',
        customerEmail: 'two@example.com',
        customerPhone: undefined,
        cardcomCustomerId: 22222,
        productsSold: [
          {
            productId: 'prod-2',
            productName: 'Product',
            quantity: 1,
            unitPriceInCents: 2000,
          },
        ],
        transactionDate: new Date('2024-08-02'),
        transactionDescription: 'Second invoice',
        transactionRevenueInCents: 1100,
      }

      const result1 = await service.createTaxInvoiceDocument(invoiceInformation1, {
        sendInvoiceByMail: true,
      })
      const result2 = await service.createTaxInvoiceDocument(invoiceInformation2, {
        sendInvoiceByMail: true,
      })

      assert.strictEqual(result1.cardcomInvoiceNumber, 1)
      assert.strictEqual(result1.cardcomDocumentLink, 'http://invoice-document.example.com/1')

      assert.strictEqual(result2.cardcomInvoiceNumber, 2)
      assert.strictEqual(result2.cardcomDocumentLink, 'http://invoice-document.example.com/2')

      // Verify both invoices were stored correctly
      const storedInvoice1 = await service._test_getTaxInvoiceDocument('1')
      assert.ok(storedInvoice1)
      assert.strictEqual(storedInvoice1.customerName, 'Customer One')

      const storedInvoice2 = await service._test_getTaxInvoiceDocument('2')
      assert.ok(storedInvoice2)
      assert.strictEqual(storedInvoice2.customerName, 'Customer Two')
    })
  })

  describe('createTaxInvoiceDocumentUrl', () => {
    it('should return URL for existing invoice document', async () => {
      const service = createTestService()

      // First create an invoice
      const invoiceInformation = {
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        customerPhone: undefined,
        cardcomCustomerId: 99999,
        productsSold: [
          {
            productId: 'prod-test',
            productName: 'Test Product',
            quantity: 1,
            unitPriceInCents: 5000,
          },
        ],
        transactionDate: new Date('2024-09-01'),
        transactionDescription: 'Test',
        transactionRevenueInCents: 1100,
      }

      const created = await service.createTaxInvoiceDocument(invoiceInformation, {
        sendInvoiceByMail: true,
      })

      // Then get the URL
      const result = await service.createTaxInvoiceDocumentUrl(
        created.cardcomInvoiceNumber.toString(),
      )

      assert.ok(result)
      assert.strictEqual(result.url, 'http://invoice-document.example.com/1')

      // Verify the stored invoice matches what was created
      const storedInvoice = await service._test_getTaxInvoiceDocument('1')
      assert.ok(storedInvoice)
      assert.strictEqual(storedInvoice.customerName, 'Test User')
      assert.strictEqual(storedInvoice.customerEmail, 'test@example.com')
      assert.strictEqual(storedInvoice.cardcomCustomerId, 99999)
    })

    it('should throw error for non-existent invoice document', async () => {
      const service = createTestService()

      await assert.rejects(
        () => service.createTaxInvoiceDocumentUrl('999'),
        /Invoice Document 999 not found/,
      )
    })

    it('should return URLs for multiple invoice documents', async () => {
      const service = createTestService()

      // Create multiple invoices
      const invoiceInfo = {
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        customerPhone: undefined,
        cardcomCustomerId: 11111,
        productsSold: [
          {
            productId: 'prod',
            productName: 'Product',
            quantity: 1,
            unitPriceInCents: 1000,
          },
        ],
        transactionDate: new Date('2024-10-01'),
        transactionDescription: 'Test',
        transactionRevenueInCents: 1100,
      }

      await service.createTaxInvoiceDocument(invoiceInfo, {sendInvoiceByMail: true})
      await service.createTaxInvoiceDocument(invoiceInfo, {sendInvoiceByMail: true})
      await service.createTaxInvoiceDocument(invoiceInfo, {sendInvoiceByMail: true})

      const url1 = await service.createTaxInvoiceDocumentUrl('1')
      const url2 = await service.createTaxInvoiceDocumentUrl('2')
      const url3 = await service.createTaxInvoiceDocumentUrl('3')

      assert.strictEqual(url1.url, 'http://invoice-document.example.com/1')
      assert.strictEqual(url2.url, 'http://invoice-document.example.com/2')
      assert.strictEqual(url3.url, 'http://invoice-document.example.com/3')

      // Verify all three invoices were stored
      const storedInvoice1 = await service._test_getTaxInvoiceDocument('1')
      const storedInvoice2 = await service._test_getTaxInvoiceDocument('2')
      const storedInvoice3 = await service._test_getTaxInvoiceDocument('3')

      assert.ok(storedInvoice1)
      assert.ok(storedInvoice2)
      assert.ok(storedInvoice3)
      assert.strictEqual(storedInvoice1.customerName, 'Test User')
      assert.strictEqual(storedInvoice2.customerName, 'Test User')
      assert.strictEqual(storedInvoice3.customerName, 'Test User')
      assert.strictEqual(storedInvoice1.transactionRevenueInCents, 1100)
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
