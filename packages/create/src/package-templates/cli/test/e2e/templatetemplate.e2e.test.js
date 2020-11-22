import path from 'path'
import mocha from 'mocha'
const {describe, it} = mocha
import chai from 'chai'
const {expect} = chai
import {shWithOutput} from '@seasquared/scripting-commons'

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('templatetemplate e2e', function () {
  it('should show help', async () => {
    const output = await shWithOutput(
      `${path.resolve(__dirname, '../../src/run-templatetemplate.js')} --help`,
    )

    expect(output)
      .to.include('--version')
      .and.include('Show version number')
      .and.include('--help')
      .and.include('Show help')
  })
})
