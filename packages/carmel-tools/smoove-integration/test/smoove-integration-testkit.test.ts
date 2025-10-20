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
          firstName: 'testfirstname',
          lastName: 'testlastname',
          email: testEmail,
          telephone: '972501234567',
          lists: [testListId],
          signupDate: new Date('2024-01-01'),
        },
        67890: {
          id: 67890,
          email: 'another@example.com',
          firstName: '67890First',
          lastName: '67890Last',
          telephone: '972509876543',
          lists: [anotherListId],
          signupDate: new Date('2024-02-01'),
        },
        11111: {
          id: 11111,
          email: 'blacklisted@example.com',
          firstName: '111111First',
          lastName: '111111Last',
          telephone: '972501111111',
          lists: [],
          signupDate: new Date('2024-03-01'),
          isDeleted: true,
        },
        22222: {
          id: 22222,
          email: 'whatever@example.com',
          firstName: '22222First',
          lastName: '22222Last',
          telephone: '972501234567',
          lists: [testListId],
          signupDate: new Date('2024-04-02'),
        },
      },
      lists: {
        [testListId]: {id: testListId, name: 'Test List'},
        [anotherListId]: {id: anotherListId, name: 'Another List'},
        300: {id: 300, name: 'Empty List'},
      },
      blacklistedEmails: new Set(['blacklisted@example.com']),
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
          signupDate: new Date('2024-04-02'),
          lists_Linked: [testListId],
        },
        {
          id: testContactId,
          email: testEmail,
          telephone: '972501234567',
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

      const result = await service.createSmooveContact({
        email: 'highest@example.com',
        firstName: 'first',
        lastName: 'last',
        telephone: '972501111111',
        birthday: undefined,
      })
      assert.ok(typeof result === 'object')
      const {smooveId} = result

      await service.changeContactLinkedLists(smooveId, {
        subscribeTo: [testListId],
        unsubscribeFrom: [],
      })

      const contact = await service.fetchSmooveContact(testContactId)
      if (contact) {
        await service.changeContactLinkedLists(testContactId, {
          subscribeTo: [testListId],
          unsubscribeFrom: [],
        })
      }

      const contacts = await service.fetchContactsOfList(testListId)

      assert.strictEqual(contacts.length, 3)
      assert.strictEqual(contacts[0].id, smooveId) // Higher ID first
      assert.strictEqual(contacts[0].firstName, 'first')
      assert.strictEqual(contacts[0].lastName, 'last')
      assert.strictEqual(contacts[1].id, 22222)
    })
  })

  describe('fetchSmooveContact', () => {
    it('should fetch contact by ID', async () => {
      const service = createTestService()

      const contact = await service.fetchSmooveContact(testContactId)

      assert.strictEqual(contact.email, testEmail)
      assert.strictEqual(contact.telephone, '972501234567')
      assert.ok(contact.lists_Linked.includes(testListId))
    })

    it.only('should fetch contact by email', async () => {
      const service = createTestService()

      const contact = await service.fetchSmooveContact(testEmail, {by: 'email'})

      assert.strictEqual(contact.id, testContactId)
      assert.strictEqual(contact.email, testEmail)
    })

    it('should throw error for non-existent contact by ID', async () => {
      const service = createTestService()

      await assert.rejects(() => service.fetchSmooveContact(999999), /Contact not found: 999999/)
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

      await service.changeContactLinkedLists(testContactId, {
        subscribeTo: [anotherListId],
        unsubscribeFrom: [],
      })

      const updatedContact = await service.fetchSmooveContact(testContactId)
      assert.ok(updatedContact)
      assert.ok(updatedContact.lists_Linked.includes(testListId))
      assert.ok(updatedContact.lists_Linked.includes(anotherListId))
    })

    it('should unsubscribe contact from lists', async () => {
      const service = createTestService()

      await service.changeContactLinkedLists(testContactId, {
        subscribeTo: [],
        unsubscribeFrom: [testListId],
      })

      const updatedContact = await service.fetchSmooveContact(testContactId)
      assert.ok(updatedContact)
      assert.ok(!updatedContact.lists_Linked.includes(testListId))
    })

    it('should handle both subscribe and unsubscribe in one call', async () => {
      const service = createTestService()

      await service.changeContactLinkedLists(testContactId, {
        subscribeTo: [anotherListId],
        unsubscribeFrom: [testListId],
      })

      const updatedContact = await service.fetchSmooveContact(testContactId)
      assert.ok(updatedContact)
      assert.ok(!updatedContact.lists_Linked.includes(testListId))
      assert.ok(updatedContact.lists_Linked.includes(anotherListId))
    })

    it('should not add duplicate subscriptions', async () => {
      const service = createTestService()

      await service.changeContactLinkedLists(testContactId, {
        subscribeTo: [testListId], // Already subscribed
        unsubscribeFrom: [],
      })

      const updatedContact = await service.fetchSmooveContact(testContactId)
      assert.ok(updatedContact)
      assert.strictEqual(
        updatedContact.lists_Linked.filter((id: number) => id === testListId).length,
        1,
      )
    })

    it('should throw error for non-existent contact', async () => {
      const service = createTestService()

      await assert.rejects(
        () =>
          service.changeContactLinkedLists(999999, {
            subscribeTo: [testListId],
            unsubscribeFrom: [],
          }),
        /Contact 999999 not found/,
      )
    })
  })

  describe('createSmooveContact', () => {
    it('should create a new contact', async () => {
      const service = createTestService()

      const result = await service.createSmooveContact({
        email: 'new@example.com',
        firstName: 'first',
        lastName: 'last',
        telephone: '972501234567',
        birthday: undefined,
      })

      assert.ok(typeof result === 'object')
      const {smooveId} = result
      const retrievedContact = await service.fetchSmooveContact(String(smooveId))
      assert.ok(retrievedContact)
      assert.strictEqual(retrievedContact.email, 'new@example.com')
      assert.strictEqual(retrievedContact.telephone, '972501234567')
      assert.strictEqual(retrievedContact.firstName, 'first')
      assert.strictEqual(retrievedContact.lastName, 'last')
      assert.deepStrictEqual(retrievedContact.lists_Linked, [])
    })

    it('should update existing contact when email already exists', async () => {
      const service = createTestService()

      // Use existing email but different telephone
      const result = await service.createSmooveContact({
        email: testEmail, // This email already exists
        firstName: 'firstUpdated',
        lastName: 'lastUpdated',
        telephone: '972509999999', // Different telephone
        birthday: undefined,
      })

      assert.ok(typeof result === 'object')
      const {smooveId} = result

      assert.strictEqual(smooveId, testContactId) // Should return existing contact ID
      const retrievedContact = await service.fetchSmooveContact(testContactId)
      assert.ok(retrievedContact)
      assert.strictEqual(retrievedContact.email, testEmail)
      assert.strictEqual(retrievedContact.telephone, '972509999999') // Should be updated
      assert.strictEqual(retrievedContact.firstName, 'firstUpdated') // Should be updated
      assert.strictEqual(retrievedContact.lastName, 'lastUpdated') // Should be updated
      assert.ok(retrievedContact.lists_Linked.includes(testListId)) // Should keep existing lists
    })

    it('should create contact with auto-incremented ID', async () => {
      const service = createTestService()

      const result1 = await service.createSmooveContact({
        email: 'first@example.com',
        firstName: 'first',
        lastName: 'last',

        telephone: undefined,
        birthday: undefined,
      })
      assert.ok(typeof result1 === 'object')
      const {smooveId: id1} = result1

      const result2 = await service.createSmooveContact({
        email: 'second@example.com',
        firstName: 'first2',
        lastName: 'last2',
        telephone: undefined,
        birthday: undefined,
      })
      assert.ok(typeof result2 === 'object')
      const {smooveId: id2} = result2

      assert.ok(id2 > id1) // Second ID should be higher
      assert.notStrictEqual(id1, id2) // IDs should be different
    })

    it('should handle contact creation without telephone', async () => {
      const service = createTestService()

      const result = await service.createSmooveContact({
        email: 'notelephone@example.com',
        firstName: 'first',
        lastName: 'last',
        telephone: undefined,
        birthday: undefined,
      })
      assert.ok(typeof result === 'object')
      const {smooveId} = result

      const retrievedContact = await service.fetchSmooveContact(String(smooveId))
      assert.ok(retrievedContact)
      assert.strictEqual(retrievedContact.email, 'notelephone@example.com')
      assert.strictEqual(retrievedContact.telephone, '') // Should default to empty string
    })
  })

  describe('updateSmooveContact', () => {
    it('should update existing contact', async () => {
      const service = createTestService()

      await service.updateSmooveContact(testContactId, {
        email: 'updated@example.com',
        firstName: 'firstUpdated',
        lastName: 'lastUpdated',
        telephone: '972501111111',
        birthday: undefined,
      })

      const updatedContact = await service.fetchSmooveContact(testContactId)
      assert.ok(updatedContact)
      assert.strictEqual(updatedContact.email, 'updated@example.com')
      assert.strictEqual(updatedContact.telephone, '972501111111')
      assert.strictEqual(updatedContact.firstName, 'firstUpdated')
      assert.strictEqual(updatedContact.lastName, 'lastUpdated')

      assert.ok(updatedContact.lists_Linked.includes(testListId)) // Should keep existing lists
    })

    it('should throw error for non-existent contact', async () => {
      const service = createTestService()

      await assert.rejects(
        () =>
          service.updateSmooveContact(999999, {
            email: 'test@example.com',
            firstName: 'first',
            lastName: 'last',
            telephone: '972501111111',
            birthday: undefined,
          }),
        /Contact 999999 not found/,
      )
    })
  })

  describe('deleteSmooveContact', () => {
    it('should soft delete (blacklist) contact', async () => {
      const service = createTestService()

      await service.deleteSmooveContact(testContactId)

      // Contact should still exist but be blacklisted
      const contact = await service.fetchSmooveContact(testContactId)
      assert.ok(contact)
      assert.strictEqual(contact.email, testEmail)

      assert.ok(service._test_isContactDeleted(testContactId))
    })

    it('should throw error for non-existent contact', async () => {
      const service = createTestService()

      await assert.rejects(() => service.deleteSmooveContact(999999), /Contact 999999 not found/)
    })
  })

  describe('restoreSmooveContact', () => {
    it('should restore blacklisted contact', async () => {
      const service = createTestService()

      // First blacklist the contact
      await service.deleteSmooveContact(testContactId)

      // Then restore it
      await service.restoreSmooveContact(testContactId)

      // Contact should be restored
      const contact = await service.fetchSmooveContact(testContactId)
      assert.ok(contact)
      assert.strictEqual(contact.email, testEmail)
      assert.ok(!service._test_isContactDeleted(testContactId))
    })

    it('should throw error for non-existent contact', async () => {
      const service = createTestService()

      await assert.rejects(() => service.restoreSmooveContact(999999), /Contact 999999 not found/)
    })
  })
})
