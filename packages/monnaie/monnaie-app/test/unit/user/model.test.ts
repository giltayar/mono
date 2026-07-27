import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {parseUserSettings} from '../../../src/domain/user/model.ts'

// the settings are a `jsonb` column, so what comes back is whatever some version of this app wrote
// into it — reading a row must never be able to fail the request that happened to load it
describe('parseUserSettings', () => {
  it('should read the settings of a user who has chosen a language', () => {
    assert.deepEqual(parseUserSettings({language: 'he'}), {language: 'he'})
  })

  it('should read the settings of a user who has chosen nothing', () => {
    assert.deepEqual(parseUserSettings({}), {})
  })

  it('should fall back to no settings for a language we no longer support', () => {
    assert.deepEqual(parseUserSettings({language: 'fr'}), {})
  })

  it('should fall back to no settings for something that is not settings at all', () => {
    for (const settings of [null, 'nonsense', 42, []]) {
      assert.deepEqual(parseUserSettings(settings), {})
    }
  })

  it('should drop a setting it does not know about', () => {
    assert.deepEqual(parseUserSettings({language: 'en', theme: 'dark'}), {language: 'en'})
  })
})
