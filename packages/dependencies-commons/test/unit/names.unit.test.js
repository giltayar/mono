import mocha from 'mocha'
const {describe, it} = mocha
import chai from 'chai'
const {expect} = chai

import {cleanName, envName} from '../../src/names.js'

describe('names (unit)', function () {
  describe('cleanName', () => {
    it('clean a regular package name without -', async () => {
      expect(cleanName('semver')).to.equal('semver')
    })

    it('clean a regular package name with "-"', async () => {
      expect(cleanName('la-lala-dida')).to.equal('la_lala_dida')
    })

    it('clean a scoped package name without "-"', async () => {
      expect(cleanName('@scope/semver')).to.equal('scope_semver')
    })

    it('clean a scoped package name with "-"', async () => {
      expect(cleanName('@scope/la-lala-dida')).to.equal('scope_la_lala_dida')
    })
  })

  describe('envName', () => {
    it('clean a regular package name without -', async () => {
      expect(envName('semver')).to.equal('SEMVER_VERSION')
    })

    it('clean a regular package name with "-"', async () => {
      expect(envName('la-lala-dida')).to.equal('LA_LALA_DIDA_VERSION')
    })

    it('clean a scoped package name without "-"', async () => {
      expect(envName('@scope/semver')).to.equal('SCOPE_SEMVER_VERSION')
    })

    it('clean a scoped package name with "-"', async () => {
      expect(envName('@scope/la-lala-dida')).to.equal('SCOPE_LA_LALA_DIDA_VERSION')
    })
  })
})
