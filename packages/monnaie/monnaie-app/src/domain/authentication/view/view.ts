import type {AuthClientConfig} from '../../../commons/auth.ts'
import {html} from '../../../commons/html-templates.ts'
import {translator} from '../../../commons/i18n.ts'
import {MainLayout} from '../../../layout/main-view.ts'

export function renderLoginPage({
  clientConfig,
  next,
}: {
  clientConfig: AuthClientConfig
  next: string
}): string {
  const t = translator('authentication')

  // signing in happens in the browser, so the client script needs both the provider's public
  // configuration and the translated messages for the errors only it can see. It travels in an
  // attribute rather than in a `<script>` tag, because the HTML parser decodes entities in
  // attributes but leaves the contents of a script element as raw text.
  const loginConfig = {
    firebase: clientConfig,
    next,
    errors: {
      invalidCredentials: t('errors.invalidCredentials'),
      tooManyRequests: t('errors.tooManyRequests'),
      unexpected: t('errors.unexpected'),
    },
  }

  return html`
    <${MainLayout}
      title=${t('page.title')}
      styleSheet="domain/authentication/view/style/style.css"
      script="login.js"
    >
      <h1>${t('page.title')}</h1>
      <form id="login-form" data-login-config=${JSON.stringify(loginConfig)}>
        <label for="email">${t('form.email')}</label>
        <input
          id="email"
          name="email"
          type="email"
          autocomplete="username"
          autocapitalize="off"
          spellcheck="false"
          required
        />
        <label for="password">${t('form.password')}</label>
        <input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
        />
        <button type="submit">${t('form.signIn')}</button>
      </form>
      <p id="login-error" role="alert" aria-live="polite"></p>
    </${MainLayout}>
  ` as string
}
