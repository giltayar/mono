import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import {MainLayout} from '../../../layout/main-view.ts'
import {version} from '../../../commons/version.ts'

const t = getFixedT(null, 'sale')

export function showSubscriptionCancelled(email: string, studentName: string, productName: string) {
  return html`
    <${MainLayout} title=${t('cancelSubscription.cancelledPageTitle')} activeNavItem="no-nav-bar">
      <div class="container">
        <div class="row justify-content-center mt-5">
          <div class="col-md-4">
            <div class="card shadow-sm">
              <div class="card-body text-center">
                <h3 class="card-title mb-4">${t('cancelSubscription.cancelledTitle')}</h3>
                <p>
                  ${t('cancelSubscription.cancelledMessage', {email, studentName, productName})}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    <//>
  `
}

export function showErrorCancellingSubscription(
  email: string,
  identifier: {salesEventNumber: number} | {productNumber: number},
) {
  const identifierText =
    'salesEventNumber' in identifier
      ? t('cancelSubscription.identifierEvent', {salesEventNumber: identifier.salesEventNumber})
      : t('cancelSubscription.identifierProduct', {productNumber: identifier.productNumber})

  return html`
    <${MainLayout} title=${t('cancelSubscription.errorPageTitle')} activeNavItem="no-nav-bar">
      <div class="container">
        <div class="row justify-content-center mt-5">
          <div class="col-md-4">
            <div class="card shadow-sm">
              <div class="card-body text-center">
                <h3 class="card-title mb-4">${t('cancelSubscription.errorCancellingTitle')}</h3>
                <p>${t('cancelSubscription.errorCancellingMessage', {email, identifierText})}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    <//>
  `
}

export function showErrorSubscriptionNotFound({
  email,
  identifier: _identifier,
  studentName,
  productName,
}: {
  email: string
  identifier: {salesEventNumber: number} | {productNumber: number}
  studentName: string | undefined
  productName: string | undefined
}) {
  return html`
    <${MainLayout} title=${t('cancelSubscription.errorPageTitle')} activeNavItem="no-nav-bar">
      <div class="container">
        <div class="row justify-content-center mt-5">
          <div class="col-md-4">
            <div class="card shadow-sm">
              <div class="card-body text-center">
                <h3 class="card-title mb-4">${t('cancelSubscription.errorNotFoundTitle')}</h3>
                <p>
                  ${!studentName &&
                  t('cancelSubscription.errorNotFoundSubscriptionNotFound', {email})}
                  ${studentName &&
                  !productName &&
                  t('cancelSubscription.errorNotFoundSubscriptionNotFound', {email})}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    <//>
  `
}

export function showErrorMultipleSalesFound(_email: string) {
  return html`
    <${MainLayout} title=${t('cancelSubscription.errorPageTitle')} activeNavItem="no-nav-bar">
      <div class="container">
        <div class="row justify-content-center mt-5">
          <div class="col-md-4">
            <div class="card shadow-sm">
              <div class="card-body text-center">
                <h3 class="card-title mb-4">${t('cancelSubscription.errorMultipleSalesTitle')}</h3>
                <p>${t('cancelSubscription.errorMultipleSalesMessage')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    <//>
  `
}

export function showCancelSubscriptionForm(email: string | undefined, _productNumber: number) {
  return html`
    <${MainLayout} title=${t('cancelSubscription.pageTitle')} activeNavItem="no-nav-bar">
      <script
        src=${`/src/${version}/domain/sale/view/js/cancel-subscription.js`}
        type="module"
      ></script>
      <div class="container">
        <div class="row justify-content-center mt-5">
          <div class="col-md-4">
            <div class="card shadow-sm">
              <div class="card-body">
                <h3 class="card-title text-center mb-4">${t('cancelSubscription.title')}</h3>
                <form method="post" id="cancel-subscription-form">
                  <div class="mb-3">
                    <label for="email" class="form-label">${t('cancelSubscription.email')}</label>
                    <input
                      type="email"
                      class="form-control"
                      id="email"
                      name="email"
                      value=${email ?? ''}
                      required
                      autofocus
                    />
                  </div>
                  <button type="submit" class="btn btn-danger w-100">
                    ${t('cancelSubscription.submit')}
                  </button>
                </form>
                <dialog id="confirm-dialog" class="rounded shadow p-4 border-0">
                  <h5 class="mb-3">${t('cancelSubscription.confirmTitle')}</h5>
                  <p>${t('cancelSubscription.confirmMessage')}</p>
                  <div class="d-flex gap-2 justify-content-end">
                    <button id="confirm-no" class="btn btn-secondary">
                      ${t('cancelSubscription.confirmNo')}
                    </button>
                    <button id="confirm-yes" class="btn btn-danger">
                      ${t('cancelSubscription.confirmYes')}
                    </button>
                  </div>
                </dialog>
              </div>
            </div>
          </div>
        </div>
      </div>
    <//>
  `
}

export function showCancelSubscriptionSuccess(
  email: string,
  studentName: string,
  productName: string,
) {
  return html`
    <${MainLayout} title=${t('cancelSubscription.cancelledPageTitle')} activeNavItem="no-nav-bar">
      <div class="container">
        <div class="row justify-content-center mt-5">
          <div class="col-md-4">
            <div class="card shadow-sm">
              <div class="card-body text-center">
                <h3 class="card-title mb-4">${t('cancelSubscription.cancelledTitle')}</h3>
                <p>
                  ${t('cancelSubscription.cancelledMessage', {email, studentName, productName})}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    <//>
  `
}
