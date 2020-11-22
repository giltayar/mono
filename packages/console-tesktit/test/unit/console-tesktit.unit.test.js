import mocha from 'mocha'
const {describe, it, beforeEach, afterEach} = mocha
import chai from 'chai'
const {expect} = chai

import {
  captureConsole,
  uncaptureConsole,
  consoleOutputAsString,
  captureConsoleInTest,
} from '../../src/console-tesktit.js'

describe('console-testkit unit', function () {
  describe('captureConsole (with silent=true)', () => {
    it('should capture the console.log and error', async () => {
      const consoleCapturer = captureConsole()
      try {
        console.log('hi %s', 'test')
        console.error('bye %s', 'test')

        expect(consoleOutputAsString({consoleCapturer})).to.equal('hi test\nbye test')
      } finally {
        uncaptureConsole({consoleCapturer})
      }
    })
  })

  describe('captureConsoleInTest (with silent=false)', () => {
    const {consoleOutputAsString, uncaptureConsole} = captureConsoleInTest(beforeEach, afterEach, {
      silent: false,
    })

    it('should capture and release', () => {
      console.log('this is %d', 3 * 4)

      expect(consoleOutputAsString()).to.equal('this is 12')
    })

    it('should capture and release independently', () => {
      console.log('this is %d', 3 * 5)

      expect(consoleOutputAsString()).to.equal('this is 15')
    })

    it('should stop capturing if lastone = true', () => {
      console.log('this is %d', 3 * 5)

      expect(consoleOutputAsString()).to.equal('this is 15')

      console.log('hello')

      expect(consoleOutputAsString()).to.equal('this is 15')
    })

    it('should not stop capturing if lastone = false', () => {
      console.log('this is %d', 3 * 5)

      expect(consoleOutputAsString({isLastTime: false})).to.equal('this is 15')

      console.log('hello')

      expect(consoleOutputAsString()).to.equal('this is 15\nhello')

      uncaptureConsole()

      console.log('not captured')

      expect(consoleOutputAsString()).to.equal('this is 15\nhello')
    })
  })
})
