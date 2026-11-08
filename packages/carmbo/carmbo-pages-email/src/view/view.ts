import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {MainLayout} from '@giltayar/carmbo-commons/layout/main-view'
import i18next, {getFixedT} from 'i18next'
import type {EmailView} from './model.ts'
import {templateTabs} from '../templates/view.ts'

const t = getFixedT(null, 'email')

export function renderEmailsPage(
  emails: EmailView[],
  {query, page}: {query: string; page: number},
): string | string[] {
  return html`
    <${MainLayout} title=${t('emails')} activeNavItem="emails">
      ${templateTabs('emails')}
      <div class="emails-view py-4">
        <div class="d-flex flex-wrap gap-3 align-items-center border-bottom pb-2">
          <h2 class="mb-0">${t('emails')}</h2>
          <form
            class="ms-auto"
            hx-get="/emails"
            hx-target=".emails-view table"
            hx-select=".emails-view table"
            hx-trigger="input changed delay:500ms from:input[type=search], submit"
            hx-push-url="true"
            hx-swap="outerHTML"
          >
            <label for="email-query" class="visually-hidden">${t('search')}</label>
            <input
              id="email-query"
              type="search"
              name="q"
              class="form-control form-control-sm"
              placeholder=${t('searchPlaceholder')}
              value=${query}
            />
          </form>
        </div>
        <div class="table-responsive">
          <table class="table mt-3 align-middle" aria-label=${t('emails')}>
            <thead>
              <tr>
                ${(
                  [
                    'number',
                    'purpose',
                    'to',
                    'community',
                    'member',
                    'createdAt',
                    'deliveredAt',
                    'successAt',
                    'retryTimestamps',
                    'sendingTimestamps',
                    'status',
                    'error',
                  ] as const
                ).map((key) => html`<th scope="col">${t(key)}</th>`)}
              </tr>
            </thead>
            <tbody>
              ${emails.map(
                (email, index) => html`
                  <tr
                    ...${
                      index === emails.length - 1 && emails.length === 50
                        ? {
                            'hx-get': `/emails?page=${page + 1}&q=${encodeURIComponent(query)}`,
                            'hx-trigger': 'revealed',
                            'hx-select': '.emails-view tbody tr',
                            'hx-swap': 'afterend',
                          }
                        : {}
                    }
                  >
                    <td>
                      <a class="btn btn-light btn-sm" href="/emails/${email.emailNumber}"
                        >${email.emailNumber}</a
                      >
                    </td>
                    <td>${t('registrationEmail')}</td>
                    <td dir="auto">${email.toEmail}</td>
                    <td><${Community} email=${email} /></td>
                    <td><${Member} email=${email} /></td>
                    <td><${Timestamp} value=${email.createdAt} /></td>
                    <td><${Timestamp} value=${email.deliveredAt} /></td>
                    <td><${Timestamp} value=${email.successAt} /></td>
                    <td><${Timestamps} values=${email.retryTimestamps} /></td>
                    <td><${Timestamps} values=${email.sendingTimestamps} /></td>
                    <td><${Status} status=${email.status} /></td>
                    <td class="text-break" dir="auto">${email.errorText}</td>
                  </tr>
                `,
              )}
              ${
                !emails.length && page === 0
                  ? html`<tr>
                      <td colspan="12">${t('empty')}</td>
                    </tr>`
                  : ''
              }
            </tbody>
          </table>
        </div>
      </div>
    </${MainLayout}>
  `
}

export function renderEmailPage(email: EmailView): string | string[] {
  const fields = [
    [t('number'), email.emailNumber],
    [t('purpose'), t('registrationEmail')],
    [t('to'), email.toEmail],
    [t('from'), email.fromEmail],
    [t('subject'), email.subject],
    [t('language'), email.language],
    [t('jobId'), email.jobId],
    [t('resendEmailId'), email.resendEmailId || '-'],
    [t('tags'), email.tags],
  ]
  return html`
    <${MainLayout} title=${t('email', {number: email.emailNumber})} activeNavItem="emails">
      <div class="email-view py-4">
        <a href="/emails">${t('back')}</a>
        <h2 class="mt-3">${t('email', {number: email.emailNumber})}</h2>
        <section class="card my-4" aria-label=${t('details')}>
          <dl class="card-body row g-3 mb-0">
            ${fields.map(
              ([label, value]) =>
                html`<div class="col-md-6">
                  <dt>${label}</dt>
                  <dd class="text-break mb-0" dir="auto">${value}</dd>
                </div>`,
            )}
            <div class="col-md-6"><dt>${t('community')}</dt><dd><${Community} email=${email} /></dd></div>
            <div class="col-md-6"><dt>${t('member')}</dt><dd><${Member} email=${email} /></dd></div>
            <div class="col-md-6"><dt>${t('createdAt')}</dt><dd><${Timestamp} value=${email.createdAt} /></dd></div>
            <div class="col-md-6"><dt>${t('deliveredAt')}</dt><dd><${Timestamp} value=${email.deliveredAt} /></dd></div>
            <div class="col-md-6"><dt>${t('successAt')}</dt><dd><${Timestamp} value=${email.successAt} /></dd></div>
            <div class="col-md-6"><dt>${t('status')}</dt><dd><${Status} status=${email.status} /></dd></div>
            <div class="col-md-6"><dt>${t('retryTimestamps')}</dt><dd><${Timestamps} values=${email.retryTimestamps} /></dd></div>
            <div class="col-md-6"><dt>${t('sendingTimestamps')}</dt><dd><${Timestamps} values=${email.sendingTimestamps} /></dd></div>
            <div class="col-12"><dt>${t('error')}</dt><dd class="text-break" dir="auto">${email.errorText || '-'}</dd></div>
          </dl>
        </section>
        <section aria-label=${t('preview')}>
          <div class="d-flex flex-wrap justify-content-between align-items-center mb-3">
            <h3 class="fs-5 mb-0">${t('preview')}</h3>
            <a href="/emails/${email.emailNumber}/html">${t('rawHtml')}</a>
          </div>
          <iframe
            title=${t('preview')}
            sandbox=""
            referrerpolicy="no-referrer"
            class="w-100 border rounded"
            style="min-height: 24rem"
            srcdoc=${`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">${email.html}`}
          ></iframe>
        </section>
        <section class="mt-4" aria-label=${t('plainText')}>
          <h3 class="fs-5">${t('plainText')}</h3>
          <pre class="text-break" style="white-space: pre-wrap" dir="auto">${email.text}</pre>
        </section>
      </div>
    </${MainLayout}>
  `
}

function Timestamp({value}: {value: string}): string | string[] {
  return value
    ? html`<time datetime=${value}
        >${new Date(value).toLocaleString(i18next.language === 'he' ? 'he-IL' : 'en-GB')}</time
      >`
    : '-'
}

function Timestamps({values}: {values: string[]}): string | string[] {
  return values.length
    ? html`<ul class="list-unstyled mb-0">
        ${values.map((value) => html`<li><${Timestamp} value=${value} /></li>`)}
      </ul>`
    : '-'
}

function Community({email}: {email: EmailView}): string | string[] {
  return email.communityNumber
    ? html`<a href="/communities/${email.communityNumber}"
        >${email.communityName || email.communityNumber}</a
      >`
    : '-'
}

function Member({email}: {email: EmailView}): string | string[] {
  return email.communityNumber && email.studentNumber
    ? html`<a href="/communities/${email.communityNumber}/members/${email.studentNumber}"
        >${email.studentName || email.studentNumber}</a
      >`
    : '-'
}

function Status({status}: {status: EmailView['status']}): string | string[] {
  const color =
    status === 'failure'
      ? 'danger'
      : status === 'success'
        ? 'success'
        : status === 'delivered'
          ? 'info'
          : 'secondary'
  return html`<span class="badge text-bg-${color}">${t(`statuses.${status}`)}</span>`
}
