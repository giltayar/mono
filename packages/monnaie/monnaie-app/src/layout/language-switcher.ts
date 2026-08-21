import {html} from '../commons/html-templates.ts'
import {currentLanguage, SUPPORTED_LANGUAGES, translator} from '../commons/i18n.ts'

/**
 * Deliberately a plain form and not HTMX: switching the language changes `lang`, `dir` and every
 * string on the page, so a full navigation is both simpler and more correct than a swap.
 */
export function LanguageSwitcher(): string {
  const t = translator('layout')
  const current = currentLanguage()

  return html`
    <form class="language-switcher" method="post" action="/language">
      <select
        name="language"
        aria-label=${t('language.label')}
        onchange="this.form.requestSubmit()"
      >
        ${SUPPORTED_LANGUAGES.map(
          (language) => html`
            <option value=${language} selected=${language === current || undefined}>
              ${language === 'he' ? '🇮🇱' : '🇺🇸'}
            </option>
          `,
        )}
      </select>
    </form>
  ` as string
}
