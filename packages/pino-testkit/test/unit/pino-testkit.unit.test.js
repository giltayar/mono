import chai from 'chai'
import mocha from 'mocha'
import pino from 'pino'
import chaiSubset from 'chai-subset'
import {loggerOptionsForRecorder, recordLogs, playbackLogs} from '../../src/pino-testkit.js'
const {describe, it} = mocha
const {expect, use} = chai
use(chaiSubset)

describe('pino-testkit (unit)', function () {
  it('you dont have to call record the first time', async () => {
    const logger = pino(loggerOptionsForRecorder)
    recordLogs()

    logger.info({a: 4}, 'hello')
    logger.info('world')

    expect(playbackLogs()).to.have.length(2)
    expect(playbackLogs()).to.containSubset([{a: 4, msg: 'hello'}, {msg: 'world'}])
  })

  it('record erases the playback', async () => {
    const logger = pino(loggerOptionsForRecorder)
    recordLogs()

    logger.info({a: 4}, 'hello')
    logger.info('world')

    expect(playbackLogs()).to.have.length(2)
    expect(playbackLogs()).to.containSubset([{a: 4, msg: 'hello'}, {msg: 'world'}])

    recordLogs()

    logger.info({a: 5}, 'a message')
    expect(playbackLogs()).to.have.length(1)
    expect(playbackLogs()).to.containSubset([{a: 5, msg: 'a message'}])
  })
})
