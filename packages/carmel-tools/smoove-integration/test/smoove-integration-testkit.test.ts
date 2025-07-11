import {describe, it} from 'node:test'
import assert from 'node:assert'
import {createFakeSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/testkit'

describe('Smoove Integration Testkit', () => {
  const testContactId = 12345
  const testEmail = 'test@example.com'
  const testListId = 100
  const anotherListId = 200

  const createTestService = () => {
    return createFakeSmooveIntegrationService({
      contacts: {
        [testContactId]: {
          id: testContactId,
          email: testEmail,
          telephone: '972501234567',
          cardcomRecurringPaymentId: 'recurring-123',
          cardcomAccountId: 'account-456',
          lists: [testListId],
          signupDate: new Date('2024-01-01'),
        },
        67890: {
          id: 67890,
          email: 'another@example.com',
          telephone: '972509876543',
          cardcomRecurringPaymentId: 'recurring-789',
          cardcomAccountId: 'account-999',
          lists: [anotherListId],
          signupDate: new Date('2024-02-01'),
        },
        11111: {
          id: 11111,
          email: 'blacklisted@example.com',
          telephone: '972501111111',
          cardcomRecurringPaymentId: '',
          cardcomAccountId: '',
          lists: [],
          signupDate: new Date('2024-03-01'),
          isBlacklisted: true,
        },
        22222: {
          id: 22222,
          email: 'whatever@example.com',
          telephone: '972501234567',
          cardcomRecurringPaymentId: '',
          cardcomAccountId: '',
          lists: [testListId],
          signupDate: new Date('2024-04-02'),
        },
      },
      lists: {
        [testListId]: {id: testListId, name: 'Test List'},
        [anotherListId]: {id: anotherListId, name: 'Another List'},
        300: {id: 300, name: 'Empty List'},
      },
    })
  }

  describe('fetchContactsOfList', () => {
    it('should return contacts linked to the specified list', async () => {
      const service = createTestService()

      const contacts = await service.fetchContactsOfList(testListId)

      assert.strictEqual(contacts.length, 2)
      assert.partialDeepStrictEqual(contacts, [
        {
          id: 22222,
          email: 'whatever@example.com',
          telephone: '972501234567',
          cardcomRecurringPaymentId: '',
          cardcomAccountId: '',
          signupDate: new Date('2024-04-02'),
          lists_Linked: [testListId],
        },
        {
          id: testContactId,
          email: testEmail,
          telephone: '972501234567',
          cardcomRecurringPaymentId: 'recurring-123',
          cardcomAccountId: 'account-456',
          signupDate: new Date('2024-01-01'),
          lists_Linked: [testListId],
        },
      ])
    })

    it('should return empty array for list with no contacts', async () => {
      const service = createTestService()

      const contacts = await service.fetchContactsOfList(300)

      assert.strictEqual(contacts.length, 0)
    })

    it('should return contacts sorted by id descending', async () => {
      const service = createTestService()

      // Add both contacts to the same list
      await service._test_addContact({
        id: 99999,
        email: 'highest@example.com',
        telephone: '972501111111',
        cardcomRecurringPaymentId: 'recurring-highest',
        cardcomAccountId: 'account-highest',
        lists: [testListId],
        signupDate: new Date('2024-04-01'),
      })

      const contact = await service.fetchSmooveContact(String(testContactId))
      if (contact) {
        await service.changeContactLinkedLists(contact, {
          subscribeTo: [testListId],
          unsubscribeFrom: [],
        })
      }

      const contacts = await service.fetchContactsOfList(testListId)

      assert.strictEqual(contacts.length, 3)
      assert.strictEqual(contacts[0].id, 99999) // Higher ID first
      assert.strictEqual(contacts[1].id, 22222)
    })
  })

  describe('fetchSmooveContact', () => {
    it('should fetch contact by ID', async () => {
      const service = createTestService()

      const contact = await service.fetchSmooveContact(String(testContactId))

      assert.strictEqual(contact.id, testContactId)
      assert.strictEqual(contact.email, testEmail)
      assert.strictEqual(contact.telephone, '972501234567')
      assert.strictEqual(contact.cardcomRecurringPaymentId, 'recurring-123')
      assert.strictEqual(contact.cardcomAccountId, 'account-456')
      assert.ok(contact.lists_Linked.includes(testListId))
    })

    it('should fetch contact by email', async () => {
      const service = createTestService()

      const contact = await service.fetchSmooveContact(testEmail, {by: 'email'})

      assert.strictEqual(contact.id, testContactId)
      assert.strictEqual(contact.email, testEmail)
    })

    it('should throw error for non-existent contact by ID', async () => {
      const service = createTestService()

      await assert.rejects(() => service.fetchSmooveContact('999999'), /Contact not found: 999999/)
    })

    it('should throw error for non-existent contact by email', async () => {
      const service = createTestService()

      await assert.rejects(
        () => service.fetchSmooveContact('nonexistent@example.com', {by: 'email'}),
        /Contact not found: nonexistent@example.com/,
      )
    })
  })

  describe('changeContactLinkedLists', () => {
    it('should subscribe contact to new lists', async () => {
      const service = createTestService()
      const contact = await service.fetchSmooveContact(String(testContactId))

      await service.changeContactLinkedLists(contact, {
        subscribeTo: [anotherListId],
        unsubscribeFrom: [],
      })

      const updatedContact = await service.fetchSmooveContact(String(testContactId))
      assert.ok(updatedContact)
      assert.ok(updatedContact.lists_Linked.includes(testListId))
      assert.ok(updatedContact.lists_Linked.includes(anotherListId))
    })

    it('should unsubscribe contact from lists', async () => {
      const service = createTestService()
      const contact = await service.fetchSmooveContact(String(testContactId))

      await service.changeContactLinkedLists(contact, {
        subscribeTo: [],
        unsubscribeFrom: [testListId],
      })

      const updatedContact = await service.fetchSmooveContact(String(testContactId))
      assert.ok(updatedContact)
      assert.ok(!updatedContact.lists_Linked.includes(testListId))
    })

    it('should handle both subscribe and unsubscribe in one call', async () => {
      const service = createTestService()
      const contact = await service.fetchSmooveContact(String(testContactId))

      await service.changeContactLinkedLists(contact, {
        subscribeTo: [anotherListId],
        unsubscribeFrom: [testListId],
      })

      const updatedContact = await service.fetchSmooveContact(String(testContactId))
      assert.ok(updatedContact)
      assert.ok(!updatedContact.lists_Linked.includes(testListId))
      assert.ok(updatedContact.lists_Linked.includes(anotherListId))
    })

    it('should not add duplicate subscriptions', async () => {
      const service = createTestService()
      const contact = await service.fetchSmooveContact(String(testContactId))

      await service.changeContactLinkedLists(contact, {
        subscribeTo: [testListId], // Already subscribed
        unsubscribeFrom: [],
      })

      const updatedContact = await service.fetchSmooveContact(String(testContactId))
      assert.ok(updatedContact)
      assert.strictEqual(
        updatedContact.lists_Linked.filter((id: number) => id === testListId).length,
        1,
      )
    })

    it('should throw error for non-existent contact', async () => {
      const service = createTestService()
      const fakeContact = {
        id: 999999,
        email: 'fake@example.com',
        telephone: '972501111111',
        cardcomRecurringPaymentId: '',
        cardcomAccountId: '',
        lists_Linked: [],
      }

      await assert.rejects(
        () =>
          service.changeContactLinkedLists(fakeContact, {
            subscribeTo: [testListId],
            unsubscribeFrom: [],
          }),
        /Contact 999999 not found/,
      )
    })
  })

  describe('updateSmooveContactWithRecurringPayment', () => {
    it('should update existing contact with recurring payment info', async () => {
      const service = createTestService()
      const newAccountId = 'new-account-123'
      const newRecurringPaymentId = 'new-recurring-456'

      const result = await service.updateSmooveContactWithRecurringPayment(
        testEmail,
        newAccountId,
        newRecurringPaymentId,
      )

      assert.deepStrictEqual(result, {success: true})

      const updatedContact = await service.fetchSmooveContact(testEmail, {by: 'email'})
      assert.ok(updatedContact)
      assert.strictEqual(updatedContact.cardcomAccountId, newAccountId)
      assert.strictEqual(updatedContact.cardcomRecurringPaymentId, newRecurringPaymentId)
    })

    it('should return "not-exists" for non-existent contact', async () => {
      const service = createTestService()

      const result = await service.updateSmooveContactWithRecurringPayment(
        'nonexistent@example.com',
        'account-123',
        'recurring-456',
      )

      assert.strictEqual(result, 'not-exists')
    })

    it('should return "blacklisted" for blacklisted contact', async () => {
      const service = createTestService()

      const result = await service.updateSmooveContactWithRecurringPayment(
        'blacklisted@example.com',
        'account-123',
        'recurring-456',
      )

      assert.strictEqual(result, 'blacklisted')
    })
  })

  describe('test helper methods', () => {
    describe('_test_getContactById', () => {
      it('should return contact by ID', async () => {
        const service = createTestService()

        const contact = await service.fetchSmooveContact(String(testContactId))

        assert.ok(contact)
        assert.strictEqual(contact.id, testContactId)
        assert.strictEqual(contact.email, testEmail)
      })

      it('should throw error for non-existent contact', async () => {
        const service = createTestService()

        await assert.rejects(
          () => service.fetchSmooveContact(String(999999)),
          /Contact not found: 999999/,
        )
      })
    })

    describe('_test_getContactByEmail', () => {
      it('should return contact by email', async () => {
        const service = createTestService()

        const contact = await service.fetchSmooveContact(testEmail, {by: 'email'})

        assert.ok(contact)
        assert.strictEqual(contact.id, testContactId)
        assert.strictEqual(contact.email, testEmail)
      })

      it('should throw error for non-existent email', async () => {
        const service = createTestService()

        await assert.rejects(
          () => service.fetchSmooveContact('nonexistent@example.com', {by: 'email'}),
          /Contact not found: nonexistent@example.com/,
        )
      })
    })
  })

  describe('_test_addContact', () => {
    it('should add a new contact', async () => {
      const service = createTestService()
      const newContact = {
        id: 88888,
        email: 'new@example.com',
        telephone: '972501234567',
        cardcomRecurringPaymentId: 'recurring-new',
        cardcomAccountId: 'account-new',
        lists: [testListId],
        signupDate: new Date('2024-06-01'),
      }

      await service._test_addContact(newContact)

      const retrievedContact = await service.fetchSmooveContact(String(88888))
      assert.ok(retrievedContact)
      assert.strictEqual(retrievedContact.email, 'new@example.com')
      assert.ok(retrievedContact.lists_Linked.includes(testListId))
    })
  })

  describe('_test_addList', () => {
    it('should add a new list', async () => {
      const service = createTestService()
      const newList = {id: 999, name: 'New Test List'}

      await service._test_addList(newList)

      // Verify by adding a contact to this list and checking if it works
      const contact = await service.fetchSmooveContact(String(testContactId))
      if (contact) {
        await service.changeContactLinkedLists(contact, {
          subscribeTo: [999],
          unsubscribeFrom: [],
        })
      }

      const contacts = await service.fetchContactsOfList(999)
      assert.strictEqual(contacts.length, 1)
    })
  })

  describe('_test_setContactBlacklisted', () => {
    it('should set contact as blacklisted', async () => {
      const service = createTestService()

      await service._test_setContactBlacklisted(testContactId, true)

      const result = await service.updateSmooveContactWithRecurringPayment(
        testEmail,
        'account-123',
        'recurring-456',
      )

      assert.strictEqual(result, 'blacklisted')
    })

    it('should remove blacklisted status', async () => {
      const service = createTestService()

      // First set as blacklisted
      await service._test_setContactBlacklisted(11111, true)

      // Then remove blacklisted status
      await service._test_setContactBlacklisted(11111, false)

      const result = await service.updateSmooveContactWithRecurringPayment(
        'blacklisted@example.com',
        'account-123',
        'recurring-456',
      )

      assert.deepStrictEqual(result, {success: true})
    })
  })
})
