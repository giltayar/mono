import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {negotiateLanguage} from '../../../src/commons/i18n.ts'

describe('negotiateLanguage', () => {
  it('should return undefined when there is no header', () => {
    assert.equal(negotiateLanguage(undefined), undefined)
    assert.equal(negotiateLanguage(''), undefined)
  })

  it('should return a supported language', () => {
    assert.equal(negotiateLanguage('en'), 'en')
    assert.equal(negotiateLanguage('he'), 'he')
  })

  it('should ignore the region and the casing of the language tag', () => {
    assert.equal(negotiateLanguage('he-IL'), 'he')
    assert.equal(negotiateLanguage('HE-il'), 'he')
    assert.equal(negotiateLanguage('en-US'), 'en')
  })

  it('should return undefined when no language is supported', () => {
    assert.equal(negotiateLanguage('fr'), undefined)
    assert.equal(negotiateLanguage('fr-FR, de, ru-RU'), undefined)
  })

  it('should skip the unsupported languages', () => {
    assert.equal(negotiateLanguage('fr, he'), 'he')
  })

  it('should prefer the language with the highest quality', () => {
    assert.equal(negotiateLanguage('en;q=0.8, he;q=0.9'), 'he')
    assert.equal(negotiateLanguage('he;q=0.9, en;q=0.8'), 'he')
    // a language with no `q` has a quality of 1
    assert.equal(negotiateLanguage('he;q=0.9, en'), 'en')
  })

  it('should keep the order of the header for equal qualities', () => {
    assert.equal(negotiateLanguage('he, en'), 'he')
    assert.equal(negotiateLanguage('en, he'), 'en')
    assert.equal(negotiateLanguage('he;q=0.5, en;q=0.5'), 'he')
  })

  it('should treat a quality of zero as "not acceptable"', () => {
    assert.equal(negotiateLanguage('he;q=0'), undefined)
    assert.equal(negotiateLanguage('he;q=0, en;q=0.1'), 'en')
  })

  it('should return the default language for a wildcard', () => {
    assert.equal(negotiateLanguage('*'), 'en')
    assert.equal(negotiateLanguage('fr, *'), 'en')
    // an explicitly supported language beats the wildcard
    assert.equal(negotiateLanguage('he, *'), 'he')
  })

  it('should tolerate whitespace', () => {
    assert.equal(negotiateLanguage('  he-IL  ,  en-US ; q=0.5  '), 'he')
  })

  it('should not accept a malformed header', () => {
    assert.equal(negotiateLanguage(',,,'), undefined)
    assert.equal(negotiateLanguage(';q=0.5'), undefined)
    assert.equal(negotiateLanguage('en;q=not-a-number'), undefined)
    assert.equal(negotiateLanguage('this is not an accept-language header'), undefined)
  })
})
