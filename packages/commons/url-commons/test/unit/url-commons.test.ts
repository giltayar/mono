import {describe, it} from 'node:test'
import assert from 'node:assert/strict'

import {
  addQueryParamToUrl,
  addQueryParamsToUrl,
  addPathParamToPathSegment,
  parsePathSegment,
  buildPathSegmentFromPathParams,
} from '../../src/url-commons.ts'

describe('url-commons (unit)', function () {
  describe('addQueryParamToUrl', () => {
    it('should add a query param with name and value to url with no query params', async () => {
      assert.equal(addQueryParamToUrl(new URL('http://foo/b'), 'x', 'y').href, 'http://foo/b?x=y')
    })

    it('should add a query param with name and value to url with some query params', async () => {
      assert(addQueryParamToUrl(new URL('http://foo/b?a=b'), 'x', 'y').href, 'http://foo/b?a=b&x=y')
    })

    it('should add a query param with name and value to url with some query params', async () => {
      assert(addQueryParamToUrl(new URL('http://foo/b?a=b'), 'x', 'y').href, 'http://foo/b?a=b&x=y')
    })

    it('should override query param with same name', async () => {
      assert(addQueryParamToUrl(new URL('http://foo/b?x=z'), 'x', 'y').href, 'http://foo/b?x=y')
    })

    it('should override multi-value query param with same name', async () => {
      assert(addQueryParamToUrl(new URL('http://foo/b?x=z&x=a'), 'x', 'y').href, 'http://foo/b?x=y')
    })
  })

  describe('addQueryParamsToUrl', () => {
    it('should add multiple query params to url with no query params', async () => {
      assert.equal(
        addQueryParamsToUrl(new URL('http://foo/b'), {x: 'y', a: 'b'}).href,
        'http://foo/b?x=y&a=b',
      )
    })

    it('should ignore undefined values', async () => {
      assert.equal(
        addQueryParamsToUrl(new URL('http://foo/b?a=b'), {x: undefined}).href,
        'http://foo/b?a=b',
      )
    })
    it('should add multiple query params to url with some query params', async () => {
      assert.equal(
        addQueryParamsToUrl(new URL('http://foo/b?c=d'), {x: 'y', a: 'b'}).href,
        'http://foo/b?c=d&x=y&a=b',
      )
    })

    it('should override query params with same names', async () => {
      assert.equal(
        addQueryParamsToUrl(new URL('http://foo/b?x=z'), {x: 'y', a: 'b'}).href,
        'http://foo/b?x=y&a=b',
      )
    })

    it('should handle empty params object', async () => {
      assert.equal(addQueryParamsToUrl(new URL('http://foo/b'), {}).href, 'http://foo/b')
    })

    it('should override multiple existing query params', async () => {
      assert.equal(
        addQueryParamsToUrl(new URL('http://foo/b?x=old&a=old'), {x: 'new', a: 'new'}).href,
        'http://foo/b?x=new&a=new',
      )
    })
  })

  describe('addPathParamToPathSegment', () => {
    it('should add a path param with name and value to url with no path params', async () => {
      assert.equal(addPathParamToPathSegment('', 'x', 'y'), 'x=y')
    })
    it('should add a path param with name only to url with no path params', async () => {
      assert.equal(addPathParamToPathSegment('', 'x', undefined), 'x')
    })

    it('should add a path param with name and value to url with some path params', async () => {
      assert.equal(addPathParamToPathSegment('a=b', 'x', 'y'), 'a=b&x=y')
    })

    it('should add a path param with name and value to url with some path params', async () => {
      assert.equal(addPathParamToPathSegment('a=b', 'x', 'y'), 'a=b&x=y')
    })

    it('should add a path param with name and value to url with some path params', async () => {
      assert.equal(addPathParamToPathSegment('a=b', 'x', 'y'), 'a=b&x=y')
    })

    it('should override path param with same name', async () => {
      assert.equal(addPathParamToPathSegment('x=z', 'x', 'y'), 'x=y')
    })
  })

  describe('parsePathSegment', () => {
    it('should return empty object for empty segment', () => {
      assert.deepEqual(parsePathSegment(''), createNullProtoObject({}))
    })

    it('should return correct object for segment with only one with only name', () => {
      assert.deepEqual(parsePathSegment('abc'), createNullProtoObject({abc: undefined}))
    })

    it('should return correct object for segment with only one with name and value', () => {
      assert.deepEqual(parsePathSegment('abc=def'), createNullProtoObject({abc: 'def'}))
    })

    it('should return correct object for segment with only one with name and blankvalue', () => {
      assert.deepEqual(parsePathSegment('abc='), createNullProtoObject({abc: ''}))
    })

    it('should return correct object for segment with more than one param with name and value', () => {
      assert.deepEqual(
        parsePathSegment('abc=def&ghi=jkl'),
        createNullProtoObject({abc: 'def', ghi: 'jkl'}),
      )
    })

    it('should return correct object for segment with more than one param with name only', () => {
      assert.deepEqual(
        parsePathSegment('abc&ghi'),
        createNullProtoObject({abc: undefined, ghi: undefined}),
      )
    })

    it('should return correct object for segment with more than one param with some blank values', () => {
      assert.deepEqual(
        parsePathSegment('abc=&ghi=jkl'),
        createNullProtoObject({abc: '', ghi: 'jkl'}),
      )
    })

    it('should return correct object for segment a value that has =', () => {
      assert.deepEqual(
        parsePathSegment('abc=def=xxx&ghi=jkl'),
        createNullProtoObject({abc: 'def=xxx', ghi: 'jkl'}),
      )
    })

    it('should return correct object for segment a value that has = at the end', () => {
      assert.deepEqual(
        parsePathSegment('abc=def=&ghi=jkl'),
        createNullProtoObject({abc: 'def=', ghi: 'jkl'}),
      )
    })

    it('should throw exception if param name is __proto__', () => {
      assert.throws(() => parsePathSegment('__proto__=a&ghi=jkl'), /proto poisoning/)
      assert.throws(() => parsePathSegment('__proto__'), /proto poisoning/)
    })
  })

  describe('buildPathSegmentFromPathParams', () => {
    it('should build empty segment from empty object', () => {
      assert.equal(buildPathSegmentFromPathParams({}), '')
    })

    it('should build name-only segment from name-only object', () => {
      assert.equal(buildPathSegmentFromPathParams({abc: undefined}), 'abc')
    })

    it('should build name-value segment from name-value object', () => {
      assert.equal(buildPathSegmentFromPathParams({abc: 'def'}), 'abc=def')
    })

    it('should build name-value segments from name-values object', () => {
      assert.equal(buildPathSegmentFromPathParams({abc: 'def', ghi: 'jkl'}), 'abc=def&ghi=jkl')
    })

    it('should build name-value segment from name-value and name-only object', () => {
      assert.equal(buildPathSegmentFromPathParams({abc: 'def', ghi: undefined}), 'abc=def&ghi')
    })

    it('should throw if name has &', () => {
      assert.throws(
        () => buildPathSegmentFromPathParams({'abc&def': 'def', ghi: undefined}),
        /separator/,
      )
    })

    it('should throw if name has =', () => {
      assert.throws(
        () => buildPathSegmentFromPathParams({'abc=def': 'def', ghi: undefined}),
        /separator/,
      )
    })

    it('should throw if value has &', () => {
      assert.throws(
        () => buildPathSegmentFromPathParams({abc: 'def&ghi', ghi: undefined}),
        /separator/,
      )
    })

    it('should NOT throw if value has &', () => {
      assert.equal(
        buildPathSegmentFromPathParams({abc: 'def=ghi', ghi: undefined}),
        'abc=def=ghi&ghi',
      )
    })
  })
})

function createNullProtoObject(from: Record<string, string | undefined>) {
  return Object.assign(Object.create(null), from)
}
