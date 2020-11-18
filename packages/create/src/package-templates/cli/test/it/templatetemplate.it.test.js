'use strict'
const {describe, it, beforeEach, afterEach} = require('mocha')
const {expect} = require('chai')
const {captureConsoleInTest} = require('@applitools/console-testkit')

const app = require('../..')

describe('templatetemplate it', function () {
  const {consoleOutputAsString} = captureConsoleInTest(beforeEach, afterEach)

  it('should show help', async () => {
    app(['--help'])
    expect(consoleOutputAsString())
      .to.include('--version')
      .and.include('Show version number')
      .and.include('--help')
      .and.include('Show help')
  })
})
