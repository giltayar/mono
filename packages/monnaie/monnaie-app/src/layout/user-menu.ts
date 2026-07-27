import {currentUser} from '../commons/auth.ts'
import {html} from '../commons/html-templates.ts'
import {translator} from '../commons/i18n.ts'

/**
 * Deliberately a plain form and not HTMX, for the same reason as the language switcher: logging out
 * replaces the whole page, so a full navigation is both simpler and more correct than a swap.
 */
export function UserMenu(): string {
  const user = currentUser()

  if (user === undefined) {
    return ''
  }

  const t = translator('layout')

  return html`
    <form class="user-menu" method="post" action="/logout">
      <span class="user-menu-user">${user.displayName ?? user.email ?? t('user.unnamed')}</span>
      <button type="submit">${t('user.logOut')}</button>
    </form>
  ` as string
}
