import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {safeReturnPath} from '../../../src/domain/authentication/model.ts'

describe('safeReturnPath', () => {
  it('should keep a path on this site', () => {
    assert.equal(safeReturnPath('/'), '/')
    assert.equal(safeReturnPath('/history'), '/history')
    assert.equal(safeReturnPath('/search?q=1+2&page=3'), '/search?q=1+2&page=3')
    assert.equal(safeReturnPath('/page#section'), '/page#section')
  })

  it('should fall back to the home page when there is nothing to return to', () => {
    assert.equal(safeReturnPath(undefined), '/')
    assert.equal(safeReturnPath(''), '/')
  })

  it('should refuse an absolute url, which would leave this site', () => {
    assert.equal(safeReturnPath('https://evil.example.com'), '/')
    assert.equal(safeReturnPath('http://evil.example.com/'), '/')
    assert.equal(safeReturnPath('javascript:alert(1)'), '/')
  })

  it('should refuse a protocol relative url, which would also leave this site', () => {
    assert.equal(safeReturnPath('//evil.example.com'), '/')
    assert.equal(safeReturnPath('//evil.example.com/history'), '/')
    // browsers normalize a backslash to a slash in the authority
    assert.equal(safeReturnPath('/\\evil.example.com'), '/')
    assert.equal(safeReturnPath('/\\/evil.example.com'), '/')
  })

  it('should refuse anything that is not a path', () => {
    assert.equal(safeReturnPath('history'), '/')
    assert.equal(safeReturnPath(' /history'), '/')
  })

  it('should refuse characters that could be smuggled into a header', () => {
    assert.equal(safeReturnPath('/history\r\nSet-Cookie: session=stolen'), '/')
    assert.equal(safeReturnPath('/history\nX-Injected: 1'), '/')
  })
})
