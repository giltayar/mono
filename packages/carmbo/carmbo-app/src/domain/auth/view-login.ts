import {html} from '../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import {MainLayout} from '../../layout/main-view.ts'
import type {Banner} from '../../layout/banner.ts'

const t = getFixedT(null, 'auth')

export function LoginPage({banner}: {banner?: Banner}) {
  return html`
    <${MainLayout} title=${t('login.pageTitle')} activeNavItem="no-nav-bar" banner=${banner}>
      <div class="container">
        <div class="row justify-content-center mt-5">
          <div class="col-md-4">
            <div class="card shadow-sm">
              <div class="card-body">
                <h3 class="card-title text-center mb-4">${t('login.dialogTitle')}</h3>
                <form hx-post="/auth/login" hx-target="body">
                  <div class="mb-3">
                    <label for="email" class="form-label">${t('login.email')}</label>
                    <input
                      type="email"
                      class="form-control"
                      id="email"
                      name="email"
                      required
                      autofocus
                    />
                  </div>
                  <div class="mb-3">
                    <label for="password" class="form-label">${t('login.password')}</label>
                    <input
                      type="password"
                      class="form-control"
                      id="password"
                      name="password"
                      required
                    />
                  </div>
                  <button type="submit" class="btn btn-primary w-100">${t('login.submit')}</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    <//>
  `
}

export function LogoutFailedPage({banner}: {banner: Banner | undefined}) {
  return html`
    <${MainLayout} title=${t('logout.pageTitle')} activeNavItem="no-nav-bar" banner=${banner}> <//>
  `
}
