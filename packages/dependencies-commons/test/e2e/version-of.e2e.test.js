import path from 'path'
import mocha from 'mocha'
const {describe, it} = mocha
import chai from 'chai'
const {expect} = chai
import {shWithOutput} from '@giltayar/scripting-commons'

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('version-of (e2e)', function () {
  it('should work', async () => {
    const output = await shWithOutput(
      [path.resolve(__dirname, '../../src/version-of.js'), 'semver'],
      {
        cwd: path.join(__dirname, 'fixtures/package'),
      },
    )

    expect(output).to.equal('1.2.3')
  })
})
