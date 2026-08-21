import {currentUser} from '../commons/auth.ts'
import {html} from '../commons/html-templates.ts'
import {translator} from '../commons/i18n.ts'
import {LanguageSwitcher} from './language-switcher.ts'

/**
 * Logging out and switching languages are deliberately plain forms: both replace the whole page,
 * so full navigations are simpler and more correct than swaps.
 */
export function UserMenu(): string {
  const user = currentUser()

  if (user === undefined) {
    return LanguageSwitcher()
  }

  const t = translator('layout')

  return html`
    <div class="user-menu">
      <${LanguageSwitcher} />
      <span class="user-menu-user">${user.displayName ?? user.email ?? t('user.unnamed')}</span>
      <form method="post" action="/logout">
        <button type="submit">${t('user.logOut')}</button>
      </form>
    </div>
  ` as string
}
