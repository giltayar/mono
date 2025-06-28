import {describe, it} from 'node:test'
import assert from 'node:assert'
import {createFakeWhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/testkit'
import type {
  WhatsAppContactId,
  WhatsAppGroupId,
} from '@giltayar/carmel-tools-whatsapp-integration/types'

describe('WhatsApp Integration Testkit', () => {
  const testGroupId = '120363123456789012@g.us' as WhatsAppGroupId
  const testParticipant1 = '972501234567@c.us' as WhatsAppContactId
  const testParticipant2 = '972509876543@c.us' as WhatsAppContactId

  const createTestService = () => {
    return createFakeWhatsAppIntegrationService({
      groups: {
        [testGroupId]: {
          name: 'Test Group',
          recentSentMessages: ['Hello sent', 'Another sent message'],
          recentReceivedMessages: ['Hello received'],
          participants: [testParticipant1, testParticipant2],
        },
        ['120363987654321098@g.us' as WhatsAppGroupId]: {
          name: 'Empty Group',
          recentSentMessages: [],
          recentReceivedMessages: [],
          participants: [],
        },
      },
    })
  }

  describe('fetchWhatsAppGroups', () => {
    it('should return all groups with their IDs and names', async () => {
      const service = createTestService()

      const groups = await service.fetchWhatsAppGroups()

      assert.strictEqual(groups.length, 2)
      assert.strictEqual(groups[0].id, testGroupId)
      assert.strictEqual(groups[0].name, 'Test Group')
      assert.strictEqual(groups[1].name, 'Empty Group')
    })
  })

  describe('fetchLastWhatsappGroupsThatWereSentMessage', () => {
    it('should return groups that have sent messages', async () => {
      const service = createTestService()

      const result = await service.fetchLastWhatsappGroupsThatWereSentMessage()

      assert.strictEqual(Object.keys(result).length, 1)
      assert.ok(result[testGroupId])
      assert.strictEqual(result[testGroupId].length, 2)
      assert.strictEqual(result[testGroupId][0].textMessage, 'Hello sent')
      assert.strictEqual(result[testGroupId][0].chatId, testGroupId)
    })
  })

  describe('fetchLastWhatsappGroupsThatWereReceivedMessage', () => {
    it('should return groups that have received messages', async () => {
      const service = createTestService()

      const result = await service.fetchLastWhatsappGroupsThatWereReceivedMessage()

      assert.strictEqual(Object.keys(result).length, 1)
      assert.ok(result[testGroupId])
      assert.strictEqual(result[testGroupId].length, 1)
      assert.strictEqual(result[testGroupId][0].textMessage, 'Hello received')
      assert.strictEqual(result[testGroupId][0].chatId, testGroupId)
    })
  })

  describe('removeParticipantFromGroup', () => {
    it('should remove a participant from the group', async () => {
      const service = createTestService()

      await service.removeParticipantFromGroup(testGroupId, testParticipant1)

      const participants = await service._test_listParticipantsInGroup(testGroupId)
      assert.strictEqual(participants.length, 1)
      assert.strictEqual(participants[0], testParticipant2)
    })

    it('should throw error if group not found', async () => {
      const service = createTestService()
      const nonExistentGroup = '999999999999999999@g.us' as WhatsAppGroupId

      await assert.rejects(
        () => service.removeParticipantFromGroup(nonExistentGroup, testParticipant1),
        /Group .* not found/,
      )
    })

    it('should throw error if participant not found in group', async () => {
      const service = createTestService()
      const nonExistentParticipant = '972500000000@c.us' as WhatsAppContactId

      await assert.rejects(
        () => service.removeParticipantFromGroup(testGroupId, nonExistentParticipant),
        /Participant .* not found in group/,
      )
    })
  })

  describe('addParticipantToGroup', () => {
    it('should add a new participant to the group', async () => {
      const service = createTestService()
      const newParticipant = '972501111111@c.us' as WhatsAppContactId

      await service.addParticipantToGroup(testGroupId, newParticipant)

      const participants = await service._test_listParticipantsInGroup(testGroupId)
      assert.strictEqual(participants.length, 3)
      assert.ok(participants.includes(newParticipant))
    })

    it('should not add duplicate participant to the group', async () => {
      const service = createTestService()

      await service.addParticipantToGroup(testGroupId, testParticipant1)

      const participants = await service._test_listParticipantsInGroup(testGroupId)
      assert.strictEqual(participants.length, 2)
      //@ts-expect-error bug in tsgo!
      assert.strictEqual(participants.filter((p) => p === testParticipant1).length, 1)
    })

    it('should throw error if group not found', async () => {
      const service = createTestService()
      const nonExistentGroup = '999999999999999999@g.us' as WhatsAppGroupId

      await assert.rejects(
        () => service.addParticipantToGroup(nonExistentGroup, testParticipant1),
        /Group .* not found/,
      )
    })
  })
})
