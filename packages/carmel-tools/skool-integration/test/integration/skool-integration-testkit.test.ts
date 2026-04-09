import {describe, it} from 'node:test'
import assert from 'node:assert'
import {createFakeSkoolIntegrationService} from '../../testkit/skool-integration-testkit.ts'

describe('Skool Integration Testkit', () => {
  const testEmail = 'student@example.com'
  const anotherEmail = 'another@example.com'

  describe('sendUniqueInviteLinkToEmail', () => {
    it('should record that an invite was sent for the email', async () => {
      const service = createFakeSkoolIntegrationService()

      await service.sendUniqueInviteLinkToEmail({email: testEmail})

      assert.strictEqual(service._test_isInviteSentForEmail(testEmail), true)
    })

    it('should not affect other emails', async () => {
      const service = createFakeSkoolIntegrationService()

      await service.sendUniqueInviteLinkToEmail({email: testEmail})

      assert.strictEqual(service._test_isInviteSentForEmail(anotherEmail), false)
    })

    it('should handle multiple invites to different emails', async () => {
      const service = createFakeSkoolIntegrationService()

      await service.sendUniqueInviteLinkToEmail({email: testEmail})
      await service.sendUniqueInviteLinkToEmail({email: anotherEmail})

      assert.strictEqual(service._test_isInviteSentForEmail(testEmail), true)
      assert.strictEqual(service._test_isInviteSentForEmail(anotherEmail), true)
    })
  })

  describe('_test_reset', () => {
    it('should clear all recorded invites', async () => {
      const service = createFakeSkoolIntegrationService()

      await service.sendUniqueInviteLinkToEmail({email: testEmail})
      await service.sendUniqueInviteLinkToEmail({email: anotherEmail})

      assert.strictEqual(service._test_isInviteSentForEmail(testEmail), true)
      assert.strictEqual(service._test_isInviteSentForEmail(anotherEmail), true)

      service._test_reset()

      assert.strictEqual(service._test_isInviteSentForEmail(testEmail), false)
      assert.strictEqual(service._test_isInviteSentForEmail(anotherEmail), false)
    })
  })
})
