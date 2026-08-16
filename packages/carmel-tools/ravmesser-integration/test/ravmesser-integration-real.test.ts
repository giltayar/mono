import {describe, it, before, after} from 'node:test'
import assert from 'node:assert/strict'
import {createRavmesserIntegrationService} from '@giltayar/carmel-tools-ravmesser-integration/service'
import {apiCall, createRavmesserApiCaller} from '../src/ravmesser-api-call.ts'

const {
  RAVMESSER_CLIENT_ID,
  RAVMESSER_CLIENT_SECRET,
  RAVMESSER_USER_TOKEN,
  RAVMESSER_BIRTHDAY_FIELD_ID,
} = process.env

const credentialsMissing =
  !RAVMESSER_CLIENT_ID ||
  !RAVMESSER_CLIENT_SECRET ||
  !RAVMESSER_USER_TOKEN ||
  !RAVMESSER_BIRTHDAY_FIELD_ID

const credentials = {
  clientId: RAVMESSER_CLIENT_ID!,
  clientSecret: RAVMESSER_CLIENT_SECRET!,
  userToken: RAVMESSER_USER_TOKEN!,
}
const api = createRavmesserApiCaller(credentials)
const PROBE_PREFIX = 'zzprobe-'

describe(
  'ravmesser-integration against the real API',
  {skip: credentialsMissing ? 'RAVMESSER_* environment variables not set' : false},
  () => {
    const service = createRavmesserIntegrationService({
      ...credentials,
      birthdayPersonalFieldId: Number(RAVMESSER_BIRTHDAY_FIELD_ID),
    })

    const email = `${PROBE_PREFIX}${Date.now()}@example.com`
    let ravmesserId: number
    let listId: number

    before(async () => {
      await deleteAllProbeData()

      listId = await service.createList(`${PROBE_PREFIX}list-${Date.now()}`)

      const result = await service.createRavmesserContact({
        firstName: 'zzprobe',
        lastName: 'Tester',
        email,
        telephone: '0501234567',
        birthday: new Date('1980-03-04'),
      })

      assert.notStrictEqual(result, 'blacklisted')

      ravmesserId = (result as {ravmesserId: number}).ravmesserId
    })

    after(async () => {
      await deleteAllProbeData()
    })

    it('should fetch the contact by id and by email', async () => {
      const byId = await service.fetchRavmesserContact(ravmesserId)
      const byEmail = await service.fetchRavmesserContact(email, {by: 'email'})

      assert.deepStrictEqual(byId, byEmail)
      assert.partialDeepStrictEqual(byId, {
        id: ravmesserId,
        firstName: 'zzprobe',
        lastName: 'Tester',
        email,
        telephone: '0501234567',
        birthday: new Date('1980-03-04'),
      })
    })

    it('should report the lists the contact is linked to', async () => {
      const {lists_Linked} = await service.fetchRavmesserContact(ravmesserId)

      assert.ok(lists_Linked.length > 0, 'contact should be linked to the all-lists list')
    })

    it('should update the contact', async () => {
      await service.updateRavmesserContact(ravmesserId, {
        firstName: 'zzprobeUpdated',
        lastName: 'Renamed',
        email,
        telephone: '0507654321',
        birthday: new Date('1990-12-25'),
      })

      assert.partialDeepStrictEqual(await service.fetchRavmesserContact(ravmesserId), {
        firstName: 'zzprobeUpdated',
        lastName: 'Renamed',
        telephone: '0507654321',
        birthday: new Date('1990-12-25'),
      })
    })

    it('should update custom fields', async () => {
      await service.updateRavmesserContactCustomFields(ravmesserId, {
        [Number(RAVMESSER_BIRTHDAY_FIELD_ID)]: new Date('1975-07-08'),
      })

      assert.partialDeepStrictEqual(await service.fetchRavmesserContact(ravmesserId), {
        birthday: new Date('1975-07-08'),
      })
    })

    it('should unsubscribe and resubscribe the contact', async () => {
      await service.deleteRavmesserContact(ravmesserId)
      await service.restoreRavmesserContact(ravmesserId)

      assert.partialDeepStrictEqual(await service.fetchRavmesserContact(ravmesserId), {
        id: ravmesserId,
      })
    })

    it('should fetch the lists including the one just created', async () => {
      assert.ok((await service.fetchLists()).some((list) => list.id === listId))
    })

    it('should subscribe to a list, find the contact there, and unsubscribe', async () => {
      await service.changeContactLinkedLists(ravmesserId, {
        subscribeTo: [listId],
        unsubscribeFrom: [],
      })

      const contacts = await service.fetchContactsOfList(listId)

      assert.partialDeepStrictEqual(
        contacts.find((contact) => contact.id === ravmesserId),
        {email, firstName: 'zzprobeUpdated'},
      )

      await service.changeContactLinkedLists(ravmesserId, {
        subscribeTo: [],
        unsubscribeFrom: [listId],
      })

      assert.deepStrictEqual(
        (await service.fetchRavmesserContact(ravmesserId)).lists_Linked.includes(listId),
        false,
      )
    })
  },
)

// Cleaning up by prefix rather than by id also clears leftovers from a run that died mid-test.
// The service exposes no hard-delete, so this goes through the raw API.
async function deleteAllProbeData(): Promise<void> {
  const subscribers = (await apiCall(api, 'GET', 'subscribers?limit=500')) as {
    data: {id: number; email: string}[]
  }

  for (const subscriber of subscribers.data.filter((s) => s.email.startsWith(PROBE_PREFIX))) {
    await apiCall(api, 'DELETE', `subscribers/${subscriber.id}`)
  }

  const lists = (await apiCall(api, 'GET', 'lists?limit=500&offset=0')) as {
    data: {id: number; name: string}[]
  }

  for (const list of lists.data.filter((l) => l.name.startsWith(PROBE_PREFIX))) {
    await apiCall(api, 'DELETE', `lists/${list.id}`)
  }
}
