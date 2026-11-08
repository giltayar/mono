import assert from 'node:assert/strict'
import {test} from 'node:test'
import {initializei18next} from '@giltayar/carmbo-commons/commons/i18next-utils'
import {templateTabs} from '../../src/layout/view.ts'
import en from '../../src/layout/locale/en.json' with {type: 'json'}
import he from '../../src/layout/locale/he.json' with {type: 'json'}

for (const [language, labels] of Object.entries({en, he})) {
  test(`shared tabs localize both links and mark only the active tab in ${language}`, async () => {
    await initializei18next(language)
    for (const activeTab of ['emails', 'templates'] as const) {
      const rendered = templateTabs(activeTab)
      const markup = Array.isArray(rendered) ? rendered.join('') : rendered
      assert.ok(markup.includes(`aria-label="${labels.templates}"`))
      const links = [...markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/g)]
      assert.equal(links.length, 2)
      for (const [index, tab] of (['emails', 'templates'] as const).entries()) {
        const [, attributes, text] = links[index]
        assert.ok(attributes.includes(`href="/emails${tab === 'templates' ? '/templates' : ''}"`))
        assert.equal(text.trim(), labels[tab])
        assert.equal(attributes.includes('aria-current="page"'), tab === activeTab)
        assert.equal(attributes.includes('class="nav-link active"'), tab === activeTab)
      }
    }
  })
}
