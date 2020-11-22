import mocha from 'mocha'
const {describe, it} = mocha
import chai from 'chai'
const {expect} = chai

import * as m from '../../src/url-commons.js'

describe('url-commons (integ)', function () {
  it('should be able to load (you can delete this test once you have others)', async () => {
    expect(m).to.not.be.undefined
  })
})
