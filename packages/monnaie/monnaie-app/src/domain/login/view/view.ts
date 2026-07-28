import {html} from '../../../commons/html-templates.ts'
import type {AuthError, PublicFirebaseConfig} from '../../../services/firebase-auth.ts'
import {translator} from '../../../commons/i18n.ts'
import {MainLayout} from '../../../layout/main-view.ts'

export function renderLoginPage(
  firebaseConfig: PublicFirebaseConfig,
  {error}: {error: AuthError | undefined},
): string {
  const t = translator('login')

  return html`
    <${MainLayout}
      title=${t('page.title')}
      styleSheet="domain/login/view/style/style.css"
      script="domain/login/view/client/google-sign-in.js"
    >
      <h1>${t('page.title')}</h1>
      <form id="login-form" method="post" action="/login">
        <label for="email">${t('form.email')}</label>
        <input
          id="email"
          type="email"
          name="email"
          autocomplete="email"
          autocapitalize="off"
          spellcheck="false"
          required
        />
        <label for="password">${t('form.password')}</label>
        <input id="password" type="password" name="password" autocomplete="current-password" required />
        ${error && html`<p class="error" role="alert">${t(`errors.${error}`)}</p>`}
        <button type="submit">${t('form.logIn')}</button>
      </form>
      <p class="alternative"><a href="/forgot-password">${t('form.forgotPassword')}</a></p>
      <p class="alternative"><a href="/register">${t('form.noAccount')}</a></p>
      <div
        id="google-sign-in"
        data-api-key=${firebaseConfig.apiKey}
        data-auth-domain=${firebaseConfig.authDomain}
        data-project-id=${firebaseConfig.projectId}
      >
        <p class="separator">${t('form.or')}</p>
        <button type="button" id="google-sign-in-button">${t('form.google')}</button>
        <p class="error" id="google-sign-in-error" role="alert" hidden>${t('errors.unavailable')}</p>
      </div>
    </${MainLayout}>
  ` as string
}
