import {it} from 'node:test'
import assert from 'node:assert/strict'
import {setTimeout} from 'node:timers/promises'
import {createWhatsAppIntegrationService} from '../../src/whatsapp-integration.ts'
import {throw_} from '@giltayar/functional-commons'
import retry from 'p-retry'

function setup() {
  return createWhatsAppIntegrationService({
    greenApiBaseUrl: new URL('https://7105.api.greenapi.com'),
    greenApiInstanceId: parseInt(
      process.env.GREEN_API_INSTANCE ?? throw_(new Error('no GREEN_API_INSTANCE')),
    ),
    greenApiKey: process.env.GREEN_API_KEY ?? throw_(new Error('no GREEN_API_KEY')),
  })
}

it('should send a message to the group', async () => {
  const service = setup()

  const message = 'this is an automated text test' + new Date().toISOString()

  const start = Date.now()

  await service.sendMessageToGroup(TEST_WHATSAPP_GROUP, message)

  const end = Date.now()

  // Wait because of rate limiting
  await setTimeout(1200)

  await retry(
    async () => {
      const [latestMessage] = await service.fetchLatestMessagesFromGroup(TEST_WHATSAPP_GROUP, 1)

      assert.ok('textMessage' in latestMessage)
      // the 5000 is to deal with time drift between servers
      assert.ok(
        latestMessage.timestamp.getTime() >= start - 5000 &&
          latestMessage.timestamp.getTime() <= end + 5000,
      )
      assert.ok(latestMessage.textMessage === message)
    },
    {retries: 5, minTimeout: 2000, maxTimeout: 2000},
  )
})

it('should send a message with media to the group', async () => {
  const service = setup()

  const message = 'this is an automated media test' + new Date().toISOString()

  const start = Date.now()

  await service.sendMessageToGroup(TEST_WHATSAPP_GROUP, message, {
    mediaUrl:
      'https://video.wixstatic.com/video/c3efef_126c7e284d4749dfa3b19e52d8b296cd/240p/mp4/file.mp4',
  })

  const end = Date.now()

  // Wait because of rate limiting
  await setTimeout(1200)

  await retry(
    async () => {
      const [latestMessage] = await service.fetchLatestMessagesFromGroup(TEST_WHATSAPP_GROUP, 1)

      assert.ok('mediaUrl' in latestMessage)
      // the 5000 is to deal with time drift between servers
      assert.ok(
        latestMessage.timestamp.getTime() >= start - 5000 &&
          latestMessage.timestamp.getTime() <= end + 5000,
      )
      assert.ok(latestMessage.caption === message)
      assert.ok(latestMessage.mediaUrl.endsWith('.mp4'))
      assert.ok(latestMessage.mediaUrl.includes(`/${process.env.GREEN_API_INSTANCE}/`))
      assert.ok(latestMessage.filename.endsWith('.mp4'))
    },
    {retries: 5, minTimeout: 2000, maxTimeout: 2000},
  )
})

const TEST_WHATSAPP_GROUP = '120363403406458434@g.us'
