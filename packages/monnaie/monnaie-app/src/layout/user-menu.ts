import {currentUser} from '../commons/auth.ts'
import {html} from '../commons/html-templates.ts'
import {translator} from '../commons/i18n.ts'
import {LanguageSwitcher} from './language-switcher.ts'

export function UserMenu(): string {
  const user = currentUser()

  if (user === undefined) {
    return LanguageSwitcher()
  }

  const t = translator('layout')

  return html`
    <div class="user-menu">
      <a
        class="settings-link"
        href="/settings"
        aria-label=${t('user.settings')}
        title=${t('user.settings')}
        >⚙</a
      >
    </div>
  ` as string
}
