import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import enLayout from '../../../src/layout/locale/en.json' with {type: 'json'}
import heLayout from '../../../src/layout/locale/he.json' with {type: 'json'}
import enAuthentication from '../../../src/domain/authentication/locale/en.json' with {type: 'json'}
import heAuthentication from '../../../src/domain/authentication/locale/he.json' with {type: 'json'}
import enCalculator from '../../../src/domain/calculator/locale/en.json' with {type: 'json'}
import heCalculator from '../../../src/domain/calculator/locale/he.json' with {type: 'json'}

// only English types the translation keys (see `src/@types/i18next.d.ts`), so a key missing from
// another language is not a compilation error and would silently render the English fallback
describe('locale completeness', () => {
  const namespaces = [
    {namespace: 'layout', en: enLayout, he: heLayout},
    {namespace: 'authentication', en: enAuthentication, he: heAuthentication},
    {namespace: 'calculator', en: enCalculator, he: heCalculator},
  ]

  for (const {namespace, en, he} of namespaces) {
    it(`should translate every key of the "${namespace}" namespace to every language`, () => {
      assert.deepStrictEqual(keysOf(he), keysOf(en))
    })
  }
})

function keysOf(translations: object, prefix = ''): string[] {
  return Object.entries(translations)
    .flatMap(([key, value]) =>
      typeof value === 'object' && value !== null
        ? keysOf(value, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    )
    .sort()
}
