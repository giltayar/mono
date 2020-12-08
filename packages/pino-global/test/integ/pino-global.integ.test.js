import {makeRecorder} from '@seasquared/pino-testkit'
import {shWithOutput} from '@seasquared/scripting-commons'
import chai from 'chai'
import chaiSubset from 'chai-subset'
import mocha from 'mocha'
import path from 'path'
import {
  initializeLoggerOptions,
  makeLogger,
  runWithChildLogger,
  initializeForTesting,
  enterWithChildLogger,
  exitFromChildLogger,
} from '../../src/pino-global.js'
import {presult} from '@seasquared/promise-commons'
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
      initializeLoggerOptions(
        'prefix:',
        undefined,
        {
          messageKey: 'event',
          ...loggerOptionsForRecorder,
        },
        {allowMultipleInitializations: true},
      )

      record()
      const logger = makeLogger({name: 'suffix'})
      logger.info({c: 6}, 'message')
      expect(playback()).to.containSubset([{c: 6, event: 'message', name: 'prefix:suffix'}])
    })

    it('makeLogger works with only logger options', () => {
      const {record, playback, loggerOptionsForRecorder} = makeRecorder()
      initializeLoggerOptions(
        undefined,
        undefined,
        {
          messageKey: 'event',
          ...loggerOptionsForRecorder,
        },
        {allowMultipleInitializations: true},
      )

      record()
      const logger = makeLogger({name: 'suffix'})
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
        {allowMultipleInitializations: true},
      )

      const logger = makeLogger({name: 'suffix'})

      record()
      logger.info({c: 6}, 'message')
      expect(playback()).to.containSubset([
        {a: 4, b: 5, c: 6, event: 'message', name: 'nameprefix:suffix'},
      ])
    })

    it('"makeLogger" with no name should use global name prefix', () => {
      const {playback, loggerOptionsForRecorder} = makeRecorder()
      initializeLoggerOptions('nameprefix:', undefined, loggerOptionsForRecorder, {
        allowMultipleInitializations: true,
      })

      const logger = makeLogger()

      logger.info('message')

      expect(playback()).to.containSubset([{msg: 'message', name: 'nameprefix:'}])
    })
  })

  describe('initialize for testing', () => {
    it('should initializeForTesting', () => {
      const {record, playback, loggerOptionsForRecorder} = makeRecorder()
      initializeForTesting(loggerOptionsForRecorder)

      const logger = makeLogger()
      record()
      logger.info('hallelujah')
      expect(playback()).to.containSubset([{msg: 'hallelujah', name: 'test'}])
    })
  })

  describe('initialization thru env variables', () => {
    it('should use global config with everything', async () => {
      const output = await shWithOutput(
        `${process.execPath} fixtures/run-with-global-pino-config-env.js`,
        {
          cwd: __dirname,
          env: {
            PINO_GLOBAL_NAME_PREFIX: 'envprefix:',
            PINO_GLOBAL_LOGGER_OPTIONS: JSON.stringify({messageKey: 'comingFromEnv'}),
            PINO_GLOBAL_BASE_BINDINGS: JSON.stringify({a: 4}),
          },
        },
      )
      expect(parsePinoOutput(output)).to.containSubset([
        {a: 10, b: 11, c: 12, init: 10, oooh: 'lala', name: 'envprefix:initprefix:suffix'},
        {a: 10, b: 11, c: 13, init: 10, oooh: 'gaga', name: 'envprefix:initprefix:suffix'},
      ])
    })
  })

  describe('initialize only once', () => {
    it('should throw if "initializeLoggerOptions" was called twice without "allowMultipleInitializations:true"', async () => {
      const [err] = await presult(
        shWithOutput(`${process.execPath} fixtures/initialize-twice.js`, {cwd: __dirname}),
      )

      expect(err).to.not.be.undefined
      expect(err.stderr).to.include(`"initializeLoggerOptions" called twice`)
    })

    it('should throw if "initializeLoggerOptions" was called once with "allowMultipleInitializations:false" and once with "allowMultipleInitializations:true"', async () => {
      const [err] = await presult(
        shWithOutput(`${process.execPath} fixtures/initialize-twice-with-false-then-true.js`, {
          cwd: __dirname,
        }),
      )

      expect(err).to.not.be.undefined
      expect(err.stderr).to.include(`Cannot overturn it to be true`)
    })
  })

  describe('runWithChildLogger', () => {
    it('should run with child logger', async () => {
      const {playback, loggerOptionsForRecorder} = makeRecorder()

      initializeLoggerOptions(
        'nameprefix:',
        {a: 4},
        {
          ...loggerOptionsForRecorder,
        },
        {allowMultipleInitializations: true},
      )
      const logger = makeLogger({name: 'logger', b: 5})
      logger.info('outside')
      const ret = await runWithChildLogger(logger.child({c: 6}), async () => {
        await 1
        logger.info('inside')
        return 42
      })
      logger.info('outside again')
      expect(ret).to.equal(42)
      expect(playback())
        .to.have.length(3)
        .and.to.containSubset([
          {a: 4, b: 5, c: undefined, msg: 'outside', name: 'nameprefix:logger'},
          {a: 4, b: 5, c: 6, msg: 'inside', name: 'nameprefix:logger'},
          {a: 4, b: 5, c: undefined, msg: 'outside again', name: 'nameprefix:logger'},
        ])
    })

    it('chilld logger should work inside runWithChildLogger', async () => {
      const {playback, loggerOptionsForRecorder} = makeRecorder()

      initializeLoggerOptions(
        'nameprefix:',
        {a: 4},
        {
          ...loggerOptionsForRecorder,
        },
        {allowMultipleInitializations: true},
      )
      const logger = makeLogger({name: 'logger', b: 5})
      logger.info('outside')
      const ret = await runWithChildLogger(logger.child({c: 6}), async () => {
        await 1
        logger.info('inside')
        logger.child({d: 7}).info('child inside')
        logger.child({x: 7, name: 'childname'}).info('child inside with name')
        logger.child({x: 8, name: 'childname'}).child({y: 9, name: 'grandchild'}).info('grandchild')
        return 42
      })
      logger.info('outside again')
      expect(ret).to.equal(42)
      expect(playback())
        .to.have.length(6)
        .and.to.containSubset([
          {a: 4, b: 5, c: undefined, msg: 'outside', name: 'nameprefix:logger'},
          {a: 4, b: 5, c: 6, msg: 'inside', name: 'nameprefix:logger'},
          {a: 4, b: 5, c: 6, d: 7, msg: 'child inside', name: 'nameprefix:logger'},
          {a: 4, b: 5, c: 6, x: 7, msg: 'child inside with name', name: 'nameprefix:childname'},
          {a: 4, b: 5, c: 6, x: 8, y: 9, msg: 'grandchild', name: 'nameprefix:grandchild'},
          {a: 4, b: 5, c: undefined, msg: 'outside again', name: 'nameprefix:logger'},
        ])
    })

    it('nested runWithChildLogger', async () => {
      const {playback, loggerOptionsForRecorder} = makeRecorder()

      initializeLoggerOptions(
        'nameprefix:',
        {a: 4},
        {
          ...loggerOptionsForRecorder,
        },
        {allowMultipleInitializations: true},
      )
      const logger = makeLogger({name: 'logger', b: 5})
      logger.info('outside')
      const ret = await runWithChildLogger(logger.child({c: 6}), async () => {
        await 1
        logger.info('inside')
        const x = runWithChildLogger(logger.child({d: 7}), () => {
          logger.info('nested inside')
          logger.child({e: 8, name: 'nested'}).info('nested inside 2')
          return 1
        })
        expect(x).to.equal(1)
        logger.info('inside')
        return 42
      })
      logger.info('outside again')
      expect(ret).to.equal(42)
      expect(playback())
        .to.have.length(6)
        .and.to.containSubset([
          {a: 4, b: 5, c: undefined, msg: 'outside', name: 'nameprefix:logger'},
          {a: 4, b: 5, c: 6, msg: 'inside', name: 'nameprefix:logger'},
          {a: 4, b: 5, c: 6, d: 7, msg: 'nested inside', name: 'nameprefix:logger'},
          {a: 4, b: 5, c: 6, d: 7, e: 8, msg: 'nested inside 2', name: 'nameprefix:nested'},
          {a: 4, b: 5, c: 6, msg: 'inside', name: 'nameprefix:logger'},
          {a: 4, b: 5, c: undefined, msg: 'outside again', name: 'nameprefix:logger'},
        ])
    })
  })

  describe('enter/Exit child logger', () => {
    it('should enter/exit with child logger', (done) => {
      const {playback, loggerOptionsForRecorder} = makeRecorder()

      initializeLoggerOptions(
        'nameprefix:',
        {a: 4},
        {
          ...loggerOptionsForRecorder,
        },
        {allowMultipleInitializations: true},
      )
      const logger = makeLogger({name: 'logger', b: 5})
      logger.info('outside')
      enterWithChildLogger(logger.child({c: 6}))
      logger.info('inside')
      exitFromChildLogger(() => {
        logger.info('outside again')
        try {
          expect(playback())
            .to.have.length(3)
            .and.to.containSubset([
              {a: 4, b: 5, c: undefined, msg: 'outside', name: 'nameprefix:logger'},
              {a: 4, b: 5, c: 6, msg: 'inside', name: 'nameprefix:logger'},
              {a: 4, b: 5, c: undefined, msg: 'outside again', name: 'nameprefix:logger'},
            ])
        } catch (err) {
          return done(err)
        }
        done()
      })
    })

    it('chilld logger should work inside runWithChildLogger', (done) => {
      const {record, playback, loggerOptionsForRecorder} = makeRecorder()

      initializeLoggerOptions(
        'nameprefix:',
        {a: 4},
        {
          ...loggerOptionsForRecorder,
        },
        {allowMultipleInitializations: true},
      )
      record()
      const logger = makeLogger({name: 'logger', b: 5})
      logger.info('outside')
      enterWithChildLogger(logger.child({c: 6}))
      logger.info('inside')
      logger.child({d: 7}).info('child inside')
      logger.child({x: 7, name: 'childname'}).info('child inside with name')
      logger.child({x: 8, name: 'childname'}).child({y: 9, name: 'grandchild'}).info('grandchild')
      exitFromChildLogger(() => {
        logger.info('outside again')
        try {
          expect(playback())
            .to.have.length(6)
            .and.to.containSubset([
              {a: 4, b: 5, c: undefined, msg: 'outside', name: 'nameprefix:logger'},
              {a: 4, b: 5, c: 6, msg: 'inside', name: 'nameprefix:logger'},
              {a: 4, b: 5, c: 6, d: 7, msg: 'child inside', name: 'nameprefix:logger'},
              {a: 4, b: 5, c: 6, x: 7, msg: 'child inside with name', name: 'nameprefix:childname'},
              {a: 4, b: 5, c: 6, x: 8, y: 9, msg: 'grandchild', name: 'nameprefix:grandchild'},
              {a: 4, b: 5, c: undefined, msg: 'outside again', name: 'nameprefix:logger'},
            ])
        } catch (err) {
          return done(err)
        }
        done()
      })
    })

    it('nested runWithChildLogger', (done) => {
      const {playback, loggerOptionsForRecorder} = makeRecorder()

      initializeLoggerOptions(
        'nameprefix:',
        {a: 4},
        {
          ...loggerOptionsForRecorder,
        },
        {allowMultipleInitializations: true},
      )
      const logger = makeLogger({name: 'logger', b: 5})
      logger.info('outside')
      enterWithChildLogger(logger.child({c: 6}))
      logger.info('inside')
      enterWithChildLogger(logger.child({d: 7}))
      logger.info('nested inside')
      logger.child({e: 8, name: 'nested'}).info('nested inside 2')
      exitFromChildLogger(() => {
        logger.info('inside')
        exitFromChildLogger(() => {
          logger.info('outside again')
          logger.child({e: 8, name: 'logger2'}).info('nested outside 2')
          try {
            expect(playback())
              .to.have.length(7)
              .and.to.containSubset([
                {a: 4, b: 5, c: undefined, msg: 'outside', name: 'nameprefix:logger'},
                {a: 4, b: 5, c: 6, msg: 'inside', name: 'nameprefix:logger'},
                {a: 4, b: 5, c: 6, d: 7, msg: 'nested inside', name: 'nameprefix:logger'},
                {a: 4, b: 5, c: 6, d: 7, e: 8, msg: 'nested inside 2', name: 'nameprefix:nested'},
                {a: 4, b: 5, c: 6, msg: 'inside', name: 'nameprefix:logger'},
                {a: 4, b: 5, c: undefined, msg: 'outside again', name: 'nameprefix:logger'},
                {a: 4, b: 5, c: undefined, msg: 'nested outside 2', name: 'nameprefix:logger2'},
              ])
          } catch (err) {
            return done(err)
          }
          done()
        })
      })
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
