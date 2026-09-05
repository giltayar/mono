import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import enLayout from '../../../src/layout/locale/en.json' with {type: 'json'}
import heLayout from '../../../src/layout/locale/he.json' with {type: 'json'}
import enExpenses from '../../../src/domain/expenses/locale/en.json' with {type: 'json'}
import heExpenses from '../../../src/domain/expenses/locale/he.json' with {type: 'json'}
import enLogin from '../../../src/domain/login/locale/en.json' with {type: 'json'}
import heLogin from '../../../src/domain/login/locale/he.json' with {type: 'json'}
import enSettings from '../../../src/domain/settings/locale/en.json' with {type: 'json'}
import heSettings from '../../../src/domain/settings/locale/he.json' with {type: 'json'}

// only English types the translation keys (see `src/@types/i18next.d.ts`), so a key missing from
// another language is not a compilation error and would silently render the English fallback
describe('locale completeness', () => {
  const namespaces = [
    {namespace: 'layout', en: enLayout, he: heLayout},
    {namespace: 'expenses', en: enExpenses, he: heExpenses},
    {namespace: 'login', en: enLogin, he: heLogin},
    {namespace: 'settings', en: enSettings, he: heSettings},
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
