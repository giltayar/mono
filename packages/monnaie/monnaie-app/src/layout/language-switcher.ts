import {html} from '../commons/html-templates.ts'
import {currentLanguage, SUPPORTED_LANGUAGES, translator} from '../commons/i18n.ts'

/**
 * Deliberately a plain form and not HTMX: switching the language changes `lang`, `dir` and every
 * string on the page, so a full navigation is both simpler and more correct than a swap.
 */
export function LanguageSwitcher(): string {
  const t = translator('layout')
  const language = currentLanguage()

  return html`
    <form class="language-switcher" method="post" action="/language">
      <label for="language">${t('language.label')}</label>
      <select id="language" name="language">
        ${SUPPORTED_LANGUAGES.map(
          (supportedLanguage) => html`
            <option
              value=${supportedLanguage}
              selected=${supportedLanguage === language || undefined}
            >
              ${t(`language.${supportedLanguage}`)}
            </option>
          `,
        )}
      </select>
      <button type="submit">${t('language.switch')}</button>
    </form>
  ` as string
}
