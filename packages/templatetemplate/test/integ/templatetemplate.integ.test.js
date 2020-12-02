import mocha from 'mocha'
const {describe, it, beforeEach, afterEach} = mocha
import chai from 'chai'
const {expect} = chai
import {captureConsoleInTest} from '@seasquared/console-tesktit'

import {app} from '../../src/templatetemplate.js'

describe('templatetemplate it', function () {
  const {consoleOutputAsString} = captureConsoleInTest(beforeEach, afterEach)

  it('should show help', async () => {
    await app(['--help'], {shouldExitOnError: false})

    expect(consoleOutputAsString())
      .to.include('--version')
      .and.include('Show version number')
      .and.include('--help')
      .and.include('Show help')
  })

  it('should execute command', async () => {
    await app(['some-command', 'hello', '--some-option=world'], {shouldExitOnError: false})

    expect(consoleOutputAsString()).to.equal('hello, world')
  })
})
