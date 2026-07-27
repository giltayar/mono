import {currentUser} from '../commons/auth.ts'
import {html} from '../commons/html-templates.ts'
import {translator} from '../commons/i18n.ts'

/**
 * Deliberately a plain form and not HTMX, for the same reason as the language switcher: signing out
 * changes the whole page, so a full navigation is both simpler and more correct than a swap.
 */
export function UserBar(): string {
  const user = currentUser()

  if (user === undefined) {
    return ''
  }

  const t = translator('layout')

  return html`
    <form class="user-bar" method="post" action="/logout">
      <span class="email">${user.email}</span>
      <button type="submit">${t('user.signOut')}</button>
    </form>
  ` as string
}
