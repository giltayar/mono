import {describe, it, beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {createFakeRavmesserIntegrationService} from '@giltayar/carmel-tools-ravmesser-integration/testkit'

const ALL_LISTS = 1

function createTestService() {
  return createFakeRavmesserIntegrationService({
    contacts: {
      10: {
        id: 10,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        telephone: '0501234567',
        birthday: new Date('1815-12-10'),
        lists: [ALL_LISTS, 2],
        signupDate: new Date('2020-01-01T00:00:00Z'),
      },
      20: {
        id: 20,
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@example.com',
        telephone: undefined,
        lists: [ALL_LISTS],
        signupDate: new Date('2021-01-01T00:00:00Z'),
      },
    },
    lists: {
      1: {id: 1, name: 'All Contacts', isAllLists: true},
      2: {id: 2, name: 'Newsletter'},
      3: {id: 3, name: 'Course A'},
    },
    blacklistedEmails: new Set(['banned@example.com']),
  })
}

describe('ravmesser-integration testkit', () => {
  let service: ReturnType<typeof createTestService>

  beforeEach(() => {
    service = createTestService()
  })

  describe('fetchContactsOfList', () => {
    it('should return the contacts linked to the list', async () => {
      assert.deepStrictEqual(await service.fetchContactsOfList(2), [
        {
          id: 10,
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
          telephone: '0501234567',
          birthday: new Date('1815-12-10'),
          signupDate: new Date('2020-01-01T00:00:00Z'),
        },
      ])
    })

    it('should return all contacts of the all-lists list', async () => {
      assert.deepStrictEqual(
        (await service.fetchContactsOfList(ALL_LISTS)).map((c) => c.id),
        [10, 20],
      )
    })

    it('should return an empty array for a list with no contacts', async () => {
      assert.deepStrictEqual(await service.fetchContactsOfList(3), [])
    })

    it('should not report the other lists of each contact', async () => {
      assert.ok(!('lists_Linked' in (await service.fetchContactsOfList(2))[0]))
    })
  })

  describe('fetchRavmesserContact', () => {
    it('should fetch a contact by id', async () => {
      assert.deepStrictEqual(await service.fetchRavmesserContact(10), {
        id: 10,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        telephone: '0501234567',
        birthday: new Date('1815-12-10'),
        lists_Linked: [ALL_LISTS, 2],
      })
    })

    it('should fetch a contact by email', async () => {
      assert.partialDeepStrictEqual(
        await service.fetchRavmesserContact('grace@example.com', {by: 'email'}),
        {id: 20, firstName: 'Grace', lastName: 'Hopper', lists_Linked: [ALL_LISTS]},
      )
    })

    it('should throw when the id does not exist', async () => {
      await assert.rejects(() => service.fetchRavmesserContact(999), /Contact not found: 999/)
    })

    it('should throw when the email does not exist', async () => {
      await assert.rejects(
        () => service.fetchRavmesserContact('nobody@example.com', {by: 'email'}),
        /Contact not found: nobody@example.com/,
      )
    })
  })

  describe('createRavmesserContact', () => {
    it('should create a new contact in the all-lists list', async () => {
      const result = await service.createRavmesserContact({
        firstName: 'Alan',
        lastName: 'Turing',
        email: 'alan@example.com',
        telephone: '0507654321',
        birthday: new Date('1912-06-23'),
      })

      assert.deepStrictEqual(result, {ravmesserId: 21})
      assert.partialDeepStrictEqual(await service.fetchRavmesserContact(21), {
        firstName: 'Alan',
        lastName: 'Turing',
        telephone: '0507654321',
        lists_Linked: [ALL_LISTS],
      })
    })

    it('should update the existing contact when the email already exists', async () => {
      const result = await service.createRavmesserContact({
        firstName: 'Ada',
        lastName: 'King',
        email: 'ada@example.com',
        telephone: undefined,
        birthday: undefined,
      })

      assert.deepStrictEqual(result, {ravmesserId: 10})
      assert.partialDeepStrictEqual(await service.fetchRavmesserContact(10), {
        lastName: 'King',
        telephone: '0501234567',
      })
    })

    it('should return blacklisted for a banned email', async () => {
      assert.strictEqual(
        await service.createRavmesserContact({
          firstName: 'Banned',
          lastName: 'Person',
          email: 'banned@example.com',
          telephone: undefined,
          birthday: undefined,
        }),
        'blacklisted',
      )
    })
  })

  describe('updateRavmesserContact', () => {
    it('should update the contact fields', async () => {
      await service.updateRavmesserContact(20, {
        firstName: 'Grace',
        lastName: 'Murray Hopper',
        email: 'grace.hopper@example.com',
        telephone: '0509999999',
        birthday: new Date('1906-12-09'),
      })

      assert.partialDeepStrictEqual(await service.fetchRavmesserContact(20), {
        lastName: 'Murray Hopper',
        email: 'grace.hopper@example.com',
        telephone: '0509999999',
        birthday: new Date('1906-12-09'),
      })
    })

    it('should throw for a non-existent contact', async () => {
      await assert.rejects(
        () =>
          service.updateRavmesserContact(999, {
            firstName: 'No',
            lastName: 'Body',
            email: 'nobody@example.com',
            telephone: undefined,
            birthday: undefined,
          }),
        /Contact not found: 999/,
      )
    })
  })

  describe('updateRavmesserContactCustomFields', () => {
    it('should merge custom fields keyed by personal field id', async () => {
      await service.updateRavmesserContactCustomFields(10, {100: 'Tel Aviv'})
      await service.updateRavmesserContactCustomFields(10, {
        200: 42,
        300: new Date('2024-05-05T00:00:00Z'),
      })

      assert.deepStrictEqual(service._test_getCustomFields(10), {
        100: 'Tel Aviv',
        200: 42,
        300: new Date('2024-05-05T00:00:00Z'),
      })
    })

    it('should throw for a non-existent contact', async () => {
      await assert.rejects(
        () => service.updateRavmesserContactCustomFields(999, {100: 'x'}),
        /Contact not found: 999/,
      )
    })
  })

  describe('deleteRavmesserContact and restoreRavmesserContact', () => {
    it('should unsubscribe the contact without removing it', async () => {
      await service.deleteRavmesserContact(10)

      assert.strictEqual(service._test_isContactUnsubscribed(10), true)
      assert.partialDeepStrictEqual(await service.fetchRavmesserContact(10), {id: 10})
    })

    it('should resubscribe the contact', async () => {
      await service.deleteRavmesserContact(10)
      await service.restoreRavmesserContact(10)

      assert.strictEqual(service._test_isContactUnsubscribed(10), false)
    })

    it('should throw for a non-existent contact', async () => {
      await assert.rejects(() => service.deleteRavmesserContact(999), /Contact not found: 999/)
      await assert.rejects(() => service.restoreRavmesserContact(999), /Contact not found: 999/)
    })
  })

  describe('changeContactLinkedLists', () => {
    it('should subscribe to new lists', async () => {
      await service.changeContactLinkedLists(20, {subscribeTo: [2, 3], unsubscribeFrom: []})

      assert.deepStrictEqual(service._test_getLists(20), [ALL_LISTS, 2, 3])
    })

    it('should unsubscribe from lists', async () => {
      await service.changeContactLinkedLists(10, {subscribeTo: [], unsubscribeFrom: [2]})

      assert.deepStrictEqual(service._test_getLists(10), [ALL_LISTS])
    })

    it('should subscribe and unsubscribe in one call', async () => {
      await service.changeContactLinkedLists(10, {subscribeTo: [3], unsubscribeFrom: [2]})

      assert.deepStrictEqual(service._test_getLists(10), [ALL_LISTS, 3])
    })

    it('should not create duplicate subscriptions', async () => {
      await service.changeContactLinkedLists(10, {subscribeTo: [2, 2], unsubscribeFrom: []})

      assert.deepStrictEqual(service._test_getLists(10), [ALL_LISTS, 2])
    })

    it('should throw for a non-existent contact', async () => {
      await assert.rejects(
        () => service.changeContactLinkedLists(999, {subscribeTo: [2], unsubscribeFrom: []}),
        /Contact not found: 999/,
      )
    })
  })

  describe('lists', () => {
    it('should fetch all lists', async () => {
      assert.deepStrictEqual(await service.fetchLists(), [
        {id: 1, name: 'All Contacts'},
        {id: 2, name: 'Newsletter'},
        {id: 3, name: 'Course A'},
      ])
    })

    it('should create a list with an auto-incremented id', async () => {
      assert.strictEqual(await service.createList('Course B'), 4)
      assert.partialDeepStrictEqual(await service.fetchLists(), [
        {id: 1, name: 'All Contacts'},
        {id: 2, name: 'Newsletter'},
        {id: 3, name: 'Course A'},
        {id: 4, name: 'Course B'},
      ])
    })
  })

  describe('_test_reset_data', () => {
    it('should restore the initial state', async () => {
      await service.deleteRavmesserContact(10)
      await service.createList('Course B')

      service._test_reset_data()

      assert.strictEqual(service._test_isContactUnsubscribed(10), false)
      assert.strictEqual((await service.fetchLists()).length, 3)
    })
  })
})
