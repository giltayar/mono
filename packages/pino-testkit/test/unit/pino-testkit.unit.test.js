import chai from 'chai'
import mocha from 'mocha'
import pino from 'pino'
import chaiSubset from 'chai-subset'
import {makeRecorder} from '../../src/pino-testkit.js'
const {describe, it} = mocha
const {expect, use} = chai
use(chaiSubset)

describe('pino-testkit (unit)', function () {
  it('you dont have to call record the first time', async () => {
    const {loggerOptionsForRecorder, playback} = makeRecorder()

    const logger = pino(loggerOptionsForRecorder)

    logger.info({a: 4}, 'hello')
    logger.info('world')

    expect(playback()).to.have.length(2)
    expect(playback()).to.containSubset([{a: 4, msg: 'hello'}, {msg: 'world'}])
  })

  it('record erases the playback', async () => {
    const {loggerOptionsForRecorder, record, playback} = makeRecorder()

    const logger = pino(loggerOptionsForRecorder)

    logger.info({a: 4}, 'hello')
    logger.info('world')

    expect(playback()).to.have.length(2)
    expect(playback()).to.containSubset([{a: 4, msg: 'hello'}, {msg: 'world'}])

    record()

    logger.info({a: 5}, 'a message')
    expect(playback()).to.have.length(1)
    expect(playback()).to.containSubset([{a: 5, msg: 'a message'}])
  })
})
