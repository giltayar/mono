import type {AuthenticatedUser} from '../../../services/firebase-auth.ts'
import {html} from '../../../commons/html-templates.ts'
import {translator} from '../../../commons/i18n.ts'
import {LanguageSwitcher} from '../../../layout/language-switcher.ts'
import {MainLayout} from '../../../layout/main-view.ts'

export function renderSettingsPage(user: AuthenticatedUser): string {
  const t = translator('settings')

  return html`
    <${MainLayout}
      title=${t('page.title')}
      heading=${t('page.title')}
      headingHref="/"
      styleSheet="domain/settings/view/style/style.css"
    >
      <div class="settings-page">
        <p class="settings-email">${user.email ?? t('account.noEmail')}</p>
        <section>
          <h2>${t('language.heading')}</h2>
          <${LanguageSwitcher} />
        </section>
        <form method="post" action="/logout">
          <button type="submit">${t('account.logOut')}</button>
        </form>
      </div>
    </${MainLayout}>
  ` as string
}
