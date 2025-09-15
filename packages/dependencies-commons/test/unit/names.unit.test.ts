import {describe, it} from 'node:test'
import assert from 'node:assert'

import {cleanName, envName} from '../../src/names.ts'

describe('names (unit)', function () {
  describe('cleanName', () => {
    it('clean a regular package name without -', async () => {
      assert.strictEqual(cleanName('semver'), 'semver')
    })

    it('clean a regular package name with "-"', async () => {
      assert.strictEqual(cleanName('la-lala-dida'), 'la_lala_dida')
    })

    it('clean a scoped package name without "-"', async () => {
      assert.strictEqual(cleanName('@scope/semver'), 'scope_semver')
    })

    it('clean a scoped package name with "-"', async () => {
      assert.strictEqual(cleanName('@scope/la-lala-dida'), 'scope_la_lala_dida')
    })
  })

  describe('envName', () => {
    it('clean a regular package name without -', async () => {
      assert.strictEqual(envName('semver'), 'SEMVER_VERSION')
    })

    it('clean a regular package name with "-"', async () => {
      assert.strictEqual(envName('la-lala-dida'), 'LA_LALA_DIDA_VERSION')
    })

    it('clean a scoped package name without "-"', async () => {
      assert.strictEqual(envName('@scope/semver'), 'SCOPE_SEMVER_VERSION')
    })

    it('clean a scoped package name with "-"', async () => {
      assert.strictEqual(envName('@scope/la-lala-dida'), 'SCOPE_LA_LALA_DIDA_VERSION')
    })
  })
})
