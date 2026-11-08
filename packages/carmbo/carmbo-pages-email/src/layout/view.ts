import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import i18next from 'i18next'
import en from './locale/en.json' with {type: 'json'}
import he from './locale/he.json' with {type: 'json'}

export function templateTabs(activeTab: 'emails' | 'templates'): string | string[] {
  const t = i18next.resolvedLanguage?.startsWith('he') ? he : en
  return html`<nav class="nav nav-tabs my-3" aria-label=${t.templates}>
    <a
      class="nav-link ${activeTab === 'emails' ? 'active' : ''}"
      aria-current=${activeTab === 'emails' ? 'page' : undefined}
      href="/emails"
      >${t.emails}</a
    >
    <a
      class="nav-link ${activeTab === 'templates' ? 'active' : ''}"
      aria-current=${activeTab === 'templates' ? 'page' : undefined}
      href="/emails/templates"
      >${t.templates}</a
    >
  </nav>`
}
