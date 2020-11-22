import mocha from 'mocha'
const {describe, it} = mocha
import chai from 'chai'
const {expect} = chai

import {
  addQueryParamToUrl,
  addPathParamToPathSegment,
  parsePathSegment,
  buildPathSegmentFromPathParams,
} from '../../src/url-commons.js'

describe('url-commons (unit)', function () {
  describe('addQueryParamToUrl', () => {
    it('should add a query param with name and value to url with no query params', async () => {
      expect(addQueryParamToUrl(new URL('http://foo/b'), 'x', 'y').href).to.equal(
        'http://foo/b?x=y',
      )
    })

    it('should add a query param with name and value to url with some query params', async () => {
      expect(addQueryParamToUrl(new URL('http://foo/b?a=b'), 'x', 'y').href).to.equal(
        'http://foo/b?a=b&x=y',
      )
    })

    it('should add a query param with name and value to url with some query params', async () => {
      expect(addQueryParamToUrl(new URL('http://foo/b?a=b'), 'x', 'y').href).to.equal(
        'http://foo/b?a=b&x=y',
      )
    })

    it('should override query param with same name', async () => {
      expect(addQueryParamToUrl(new URL('http://foo/b?x=z'), 'x', 'y').href).to.equal(
        'http://foo/b?x=y',
      )
    })

    it('should override multi-value query param with same name', async () => {
      expect(addQueryParamToUrl(new URL('http://foo/b?x=z&x=a'), 'x', 'y').href).to.equal(
        'http://foo/b?x=y',
      )
    })
  })

  describe('addPathParamToPathSegment', () => {
    it('should add a path param with name and value to url with no path params', async () => {
      expect(addPathParamToPathSegment('', 'x', 'y')).to.equal('x=y')
    })
    it('should add a path param with name only to url with no path params', async () => {
      expect(addPathParamToPathSegment('', 'x', undefined)).to.equal('x')
    })

    it('should add a path param with name and value to url with some path params', async () => {
      expect(addPathParamToPathSegment('a=b', 'x', 'y')).to.equal('a=b&x=y')
    })

    it('should add a path param with name and value to url with some path params', async () => {
      expect(addPathParamToPathSegment('a=b', 'x', 'y')).to.equal('a=b&x=y')
    })

    it('should add a path param with name and value to url with some path params', async () => {
      expect(addPathParamToPathSegment('a=b', 'x', 'y')).to.equal('a=b&x=y')
    })

    it('should override path param with same name', async () => {
      expect(addPathParamToPathSegment('x=z', 'x', 'y')).to.equal('x=y')
    })
  })

  describe('parsePathSegment', () => {
    it('should return empty object for empty segment', () => {
      expect(parsePathSegment('')).to.eql({})
    })

    it('should return correct object for segment with only one with only name', () => {
      expect(parsePathSegment('abc')).to.eql({abc: undefined})
    })

    it('should return correct object for segment with only one with name and value', () => {
      expect(parsePathSegment('abc=def')).to.eql({abc: 'def'})
    })

    it('should return correct object for segment with only one with name and blankvalue', () => {
      expect(parsePathSegment('abc=')).to.eql({abc: ''})
    })

    it('should return correct object for segment with more than one param with name and value', () => {
      expect(parsePathSegment('abc=def&ghi=jkl')).to.eql({abc: 'def', ghi: 'jkl'})
    })

    it('should return correct object for segment with more than one param with name only', () => {
      expect(parsePathSegment('abc&ghi')).to.eql({abc: undefined, ghi: undefined})
    })

    it('should return correct object for segment with more than one param with some blank values', () => {
      expect(parsePathSegment('abc=&ghi=jkl')).to.eql({abc: '', ghi: 'jkl'})
    })

    it('should return correct object for segment a value that has =', () => {
      expect(parsePathSegment('abc=def=xxx&ghi=jkl')).to.eql({abc: 'def=xxx', ghi: 'jkl'})
    })

    it('should return correct object for segment a value that has = at the end', () => {
      expect(parsePathSegment('abc=def=&ghi=jkl')).to.eql({abc: 'def=', ghi: 'jkl'})
    })

    it('should throw exception if param name is __proto__', () => {
      expect(() => parsePathSegment('__proto__=a&ghi=jkl')).to.throw(/proto poisoning/)
      expect(() => parsePathSegment('__proto__')).to.throw(/proto poisoning/)
    })
  })

  describe('buildPathSegmentFromPathParams', () => {
    it('should build empty segment from empty object', () => {
      expect(buildPathSegmentFromPathParams({})).to.eql('')
    })

    it('should build name-only segment from name-only object', () => {
      expect(buildPathSegmentFromPathParams({abc: undefined})).to.eql('abc')
    })

    it('should build name-value segment from name-value object', () => {
      expect(buildPathSegmentFromPathParams({abc: 'def'})).to.eql('abc=def')
    })

    it('should build name-value segments from name-values object', () => {
      expect(buildPathSegmentFromPathParams({abc: 'def', ghi: 'jkl'})).to.eql('abc=def&ghi=jkl')
    })

    it('should build name-value segment from name-value and name-only object', () => {
      expect(buildPathSegmentFromPathParams({abc: 'def', ghi: undefined})).to.eql('abc=def&ghi')
    })

    it('should throw if name has &', () => {
      expect(() => buildPathSegmentFromPathParams({'abc&def': 'def', ghi: undefined})).to.throw(
        /separator/,
      )
    })

    it('should throw if name has =', () => {
      expect(() => buildPathSegmentFromPathParams({'abc=def': 'def', ghi: undefined})).to.throw(
        /separator/,
      )
    })

    it('should throw if value has &', () => {
      expect(() => buildPathSegmentFromPathParams({abc: 'def&ghi', ghi: undefined})).to.throw(
        /separator/,
      )
    })

    it('should NOT throw if value has &', () => {
      expect(buildPathSegmentFromPathParams({abc: 'def=ghi', ghi: undefined})).to.eql(
        'abc=def=ghi&ghi',
      )
    })
  })
})
