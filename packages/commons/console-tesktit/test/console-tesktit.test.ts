import {describe, it, beforeEach, afterEach} from 'node:test'
import assert from 'node:assert'

import {
  captureConsole,
  uncaptureConsole,
  consoleOutputAsString,
  captureConsoleInTest,
} from '../src/console-tesktit.ts'

describe('console-testkit unit', () => {
  describe('captureConsole (with silent=true)', () => {
    it('should capture the console.log and error', () => {
      const consoleCapturer = captureConsole()
      try {
        console.log('hi %s', 'test')
        console.error('bye %s', 'test')

        assert.strictEqual(consoleOutputAsString({consoleCapturer}), 'hi test\nbye test')
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

      assert.strictEqual(consoleOutputAsString(), 'this is 12')
    })

    it('should capture and release independently', () => {
      console.log('this is %d', 3 * 5)

      assert.strictEqual(consoleOutputAsString(), 'this is 15')
    })

    it('should stop capturing if lastone = true', () => {
      console.log('this is %d', 3 * 5)

      assert.strictEqual(consoleOutputAsString(), 'this is 15')

      console.log('hello')

      assert.strictEqual(consoleOutputAsString(), 'this is 15')
    })

    it('should not stop capturing if lastone = false', () => {
      console.log('this is %d', 3 * 5)

      assert.strictEqual(consoleOutputAsString({isLastTime: false}), 'this is 15')

      console.log('hello')

      assert.strictEqual(consoleOutputAsString(), 'this is 15\nhello')

      uncaptureConsole()

      console.log('not captured')

      assert.strictEqual(consoleOutputAsString(), 'this is 15\nhello')
    })
  })
})
