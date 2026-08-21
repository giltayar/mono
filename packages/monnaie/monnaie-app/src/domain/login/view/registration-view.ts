import {html} from '../../../commons/html-templates.ts'
import {translator} from '../../../commons/i18n.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {PASSWORD_MIN_LENGTH, type RegistrationError} from '../model.ts'

export function renderRegistrationPage({
  error,
  email,
}: {
  error: RegistrationError | undefined
  email: string
}): string {
  const t = translator('login')

  return html`
    <${MainLayout}
      title=${t('page.registrationTitle')}
      heading=${t('page.registrationTitle')}
      styleSheet="domain/login/view/style/style.css"
    >
      <form id="registration-form" method="post" action="/register">
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
        <label for="password">${t('form.password')}</label>
        <input
          id="password"
          type="password"
          name="password"
          autocomplete="new-password"
          minlength=${PASSWORD_MIN_LENGTH}
          required
        />
        <p class="hint">${t('form.passwordHint', {count: PASSWORD_MIN_LENGTH})}</p>
        <label for="confirm-password">${t('form.confirmPassword')}</label>
        <input
          id="confirm-password"
          type="password"
          name="confirmPassword"
          autocomplete="new-password"
          required
        />
        ${error && html`<p class="error" role="alert">${t(`errors.${error}`)}</p>`}
        <button type="submit">${t('form.register')}</button>
      </form>
      <p class="alternative"><a href="/login">${t('form.haveAccount')}</a></p>
    </${MainLayout}>
  ` as string
}

/**
 * Says the same thing whether or not the address was already taken, so that the page cannot be used
 * to find out who has an account here.
 */
export function renderVerificationSentPage(email: string): string {
  const t = translator('login')

  return html`
    <${MainLayout}
      title=${t('page.verificationSentTitle')}
      heading=${t('page.verificationSentTitle')}
      styleSheet="domain/login/view/style/style.css"
    >
      <p>${t('page.verificationSentBody', {email})}</p>
      <p class="alternative"><a href="/login">${t('form.logIn')}</a></p>
    </${MainLayout}>
  ` as string
}
