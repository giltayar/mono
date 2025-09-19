import * as path from 'node:path'
import {describe, it} from 'node:test'
import assert from 'node:assert'
import {execa} from 'execa'

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

describe('version-of (e2e)', function () {
  it('should work', async () => {
    const {stdout} = await execa(path.resolve(__dirname, '../../src/version-of.ts'), ['semver'], {
      cwd: path.join(__dirname, 'fixtures/package'),
    })

    assert.strictEqual(stdout, '1.2.3')
  })
})
