import {html} from '../../../commons/html-templates.ts'
import {translator} from '../../../commons/i18n.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import type {PasswordResetError} from '../model.ts'

export function renderForgotPasswordPage({
  error,
  email,
}: {
  error: PasswordResetError | undefined
  email: string
}): string {
  const t = translator('login')

  return html`
    <${MainLayout}
      title=${t('page.forgotPasswordTitle')}
      styleSheet="domain/login/view/style/style.css"
    >
      <h1>${t('page.forgotPasswordTitle')}</h1>
      <p>${t('page.forgotPasswordBody')}</p>
      <form id="forgot-password-form" method="post" action="/forgot-password">
        <label for="email">${t('form.email')}</label>
        <input
          id="email"
          type="email"
          name="email"
          value=${email}
          autocomplete="email"
          autocapitalize="off"
          spellcheck="false"
          required
        />
        ${error && html`<p class="error" role="alert">${t(`errors.${error}`)}</p>`}
        <button type="submit">${t('form.sendResetLink')}</button>
      </form>
      <p class="alternative"><a href="/login">${t('form.haveAccount')}</a></p>
    </${MainLayout}>
  ` as string
}

/**
 * Says the same thing whether or not the address has an account, so that the page cannot be used to
 * find out who has one here.
 */
export function renderPasswordResetSentPage(email: string): string {
  const t = translator('login')

  return html`
    <${MainLayout}
      title=${t('page.resetSentTitle')}
      styleSheet="domain/login/view/style/style.css"
    >
      <h1>${t('page.resetSentTitle')}</h1>
      <p>${t('page.resetSentBody', {email})}</p>
      <p class="alternative"><a href="/login">${t('form.logIn')}</a></p>
    </${MainLayout}>
  ` as string
}
