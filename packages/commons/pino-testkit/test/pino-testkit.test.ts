import {describe, it} from 'node:test'
import assert from 'node:assert'
import {pino} from 'pino'
import {loggerOptionsForRecorder, recordLogs, playbackLogs} from '../src/pino-testkit.ts'

describe('pino-testkit (unit)', () => {
  it('you dont have to call record the first time', () => {
    const logger = pino(loggerOptionsForRecorder)
    recordLogs()

    logger.info({a: 4}, 'hello')
    logger.info('world')

    const logs = playbackLogs()
    assert.strictEqual(logs.length, 2)
    assert.strictEqual(logs[0].a, 4)
    assert.strictEqual(logs[0].msg, 'hello')
    assert.strictEqual(logs[1].msg, 'world')
  })

  it('record erases the playback', () => {
    const logger = pino(loggerOptionsForRecorder)
    recordLogs()

    logger.info({a: 4}, 'hello')
    logger.info('world')

    let logs = playbackLogs()
    assert.strictEqual(logs.length, 2)
    assert.strictEqual(logs[0].a, 4)
    assert.strictEqual(logs[0].msg, 'hello')
    assert.strictEqual(logs[1].msg, 'world')

    recordLogs()

    logger.info({a: 5}, 'a message')
    logs = playbackLogs()
    assert.strictEqual(logs.length, 1)
    assert.strictEqual(logs[0].a, 5)
    assert.strictEqual(logs[0].msg, 'a message')
  })
})
