import {makeRecorder} from '@seasquared/pino-testkit'
import {shWithOutput} from '@seasquared/scripting-commons'
import chai from 'chai'
import chaiSubset from 'chai-subset'
import mocha from 'mocha'
import path from 'path'
import {initializeLoggerOptions, makeLogger} from '../../src/pino-global.js'
const {describe, it, before} = mocha
const {expect, use} = chai
use(chaiSubset)

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('pino-global (integ)', function () {
  describe('explicit initialization', () => {
    before(() => {
      delete process.env.GLOBAL_PINO_CONFIG
    })
    it('makeLogger works without initializing', async () => {
      const output = await shWithOutput(`${process.execPath} fixtures/run-with-initialize.js`, {
        cwd: __dirname,
      })
      expect(parsePinoOutput(output)).to.containSubset([{c: 3, msg: 'e1', name: 'suffix'}])
    })

    it('makeLogger works with default intialization', async () => {
      const output = await shWithOutput(
        `${process.execPath} fixtures/run-with-initialize.js '[]'`,
        {
          cwd: __dirname,
        },
      )
      expect(parsePinoOutput(output)).to.containSubset([{c: 3, msg: 'e1', name: 'suffix'}])
    })

    it('makeLogger works with only name initialization', async () => {
      const output = await shWithOutput(
        `${process.execPath} fixtures/run-with-initialize.js '["prefix:"]'`,
        {
          cwd: __dirname,
        },
      )

      expect(parsePinoOutput(output)).to.containSubset([{c: 3, msg: 'e1', name: 'prefix:suffix'}])
    })

    it('makeLogger works with only name initialization and base', async () => {
      const output = await shWithOutput(
        `${process.execPath} fixtures/run-with-initialize.js '["prefix:", {"a": 4, "b": 5}]'`,
        {
          cwd: __dirname,
        },
      )
      expect(parsePinoOutput(output)).to.containSubset([
        {a: 4, b: 5, c: 3, msg: 'e1', name: 'prefix:suffix'},
      ])
    })

    it('makeLogger works with only name initialization and logger options', () => {
      const {record, playback, loggerOptionsForRecorder} = makeRecorder()
      initializeLoggerOptions('prefix:', undefined, {
        messageKey: 'event',
        ...loggerOptionsForRecorder,
      })

      record()
      const logger = makeLogger('suffix')
      logger.info({c: 6}, 'message')
      expect(playback()).to.containSubset([{c: 6, event: 'message', name: 'prefix:suffix'}])
    })

    it('makeLogger works with only logger options', () => {
      const {record, playback, loggerOptionsForRecorder} = makeRecorder()
      initializeLoggerOptions(undefined, undefined, {
        messageKey: 'event',
        ...loggerOptionsForRecorder,
      })

      record()
      const logger = makeLogger('suffix')
      logger.info({c: 6}, 'message')
      expect(playback()).to.containSubset([{c: 6, event: 'message', name: 'suffix'}])
    })

    it('makeLogger works with everything initialized', () => {
      const {record, playback, loggerOptionsForRecorder} = makeRecorder()

      initializeLoggerOptions(
        'nameprefix:',
        {a: 4, b: 5},
        {
          messageKey: 'event',
          ...loggerOptionsForRecorder,
        },
      )

      const logger = makeLogger('suffix')

      record()
      logger.info({c: 6}, 'message')
      expect(playback()).to.containSubset([
        {a: 4, b: 5, c: 6, event: 'message', name: 'nameprefix:suffix'},
      ])
    })

    it('makeLogger overrides initialization', () => {
      const {record, playback, loggerOptionsForRecorder} = makeRecorder()

      initializeLoggerOptions(
        'nameprefix:',
        {a: 4, b: 5},
        {
          messageKey: 'event',
          ...loggerOptionsForRecorder,
        },
      )

      const logger = makeLogger('suffix', {b: 6, d: 7}, {messageKey: 'evento'})

      record()
      logger.info({c: 6}, 'message')
      expect(playback()).to.containSubset([
        {a: 4, b: 6, c: 6, d: 7, evento: 'message', name: 'nameprefix:suffix'},
      ])
    })
  })
  describe('initialization thru env variables', () => {
    it('should use global config with everything', async () => {
      const output = await shWithOutput(
        `${process.execPath} fixtures/run-with-global-pino-config-env.js`,
        {
          cwd: __dirname,
          env: {
            GLOBAL_PINO_CONFIG: JSON.stringify({
              globalNamePrefix: 'envprefix:',
              globalLoggerOptions: {messageKey: 'comingFromEnv'},
              globalLoggerBase: {a: 4},
            }),
          },
        },
      )
      expect(parsePinoOutput(output)).to.containSubset([
        {a: 10, b: 11, c: 12, init: 10, oooh: 'lala', name: 'envprefix:initprefix:suffix'},
        {a: 10, b: 11, c: 13, init: 10, oooh: 'gaga', name: 'envprefix:initprefix:suffix'},
      ])
    })
  })
})

/**
 * @param {string} output
 * @returns {object[]}
 */
function parsePinoOutput(output) {
  return output
    .trim()
    .split('\n')
    .map(/**@param {string} l*/ (l) => JSON.parse(l))
}
