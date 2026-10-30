import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {MainLayout} from '@giltayar/carmbo-commons/layout/main-view'
import type {Banner} from '@giltayar/carmbo-commons/layout/banner'
import {BannerComponent} from '@giltayar/carmbo-commons/layout/banner'
import {generateItemTitle} from '@giltayar/carmbo-commons/commons/view-commons'
import {getFixedT, default as i18next} from 'i18next'
import {Layout} from './layout.ts'
import {memberText, roles} from './member-text.ts'
import type {
  MemberPageView,
  MemberRolesView,
  MemberActionView,
  NewMemberStudentView,
  StudentChoiceView,
  NewMemberView,
} from './member-model.ts'

const t = getFixedT(null, 'community')

function MemberRolesFields({view}: {view: Omit<MemberRolesView, 'expectedHistoryId'>}) {
  return html`
    <div class="form-check form-switch mb-3">
      <input id="member-role-viewer" class="form-check-input" type="checkbox" checked disabled />
      <label class="form-check-label" for="member-role-viewer">${t('members.roles.viewer')}</label>
    </div>
    ${roles.map(
      (role) =>
        html`<div class="form-check form-switch mb-3">
          <input
            id="member-role-${role}"
            class="form-check-input"
            type="checkbox"
            name=${role}
            checked=${!!view[role]}
          />
          <label class="form-check-label" for="member-role-${role}"
            >${memberText('roles', role)}</label
          >
        </div>`,
    )}
  `
}

function MemberBreadcrumbs({
  communityNumber,
  communityName,
  current,
}: {
  communityNumber: number
  communityName: string
  current: string
}) {
  return html`<nav
    aria-label=${t('members.breadcrumb')}
    style=${`--bs-breadcrumb-divider: '${i18next.dir() === 'rtl' ? '<' : '>'}';`}
  >
    <ol class="breadcrumb small mb-3">
      <li class="breadcrumb-item"><a href="/communities">${t('list.communities')}</a></li>
      <li class="breadcrumb-item">
        <a href="/communities/${communityNumber}/members">${communityName}</a>
      </li>
      <li class="breadcrumb-item active text-break" aria-current="page">${current}</li>
    </ol>
  </nav>`
}

export function renderMemberPage(
  page: MemberPageView,
  {
    banner,
    rolesView,
    actionView,
  }: {
    banner?: Banner
    rolesView?: MemberRolesView
    actionView?: MemberActionView
  } = {},
): string | string[] {
  const base = `/communities/${page.communityNumber}/members/${page.member.studentNumber}`
  const displayedRoles = rolesView ?? page.member
  const blocked = page.member.status === 'unregistered' && page.member.reasonCode === 'blocked'
  return html`
    <${MainLayout} title=${t('members.membership')} activeNavItem="communities" banner=${banner}>
      <${Layout}>
        <div class="member-detail col-xl-10 mx-auto py-4">
        <header class="mb-4">
          <${MemberBreadcrumbs} communityNumber=${page.communityNumber} communityName=${page.communityName} current=${page.member.name} />
          <p class="text-body-secondary small mb-1">${t('members.membership')}</p>
          <h2 class="mb-0">${page.member.name}</h2>
        </header>
        ${
          page.historical
            ? html`<div class="alert alert-info d-flex flex-wrap justify-content-between gap-2">
                <span>${t('members.historical')}</span>
                <a class="alert-link" href=${base}>${t('members.current')}</a>
              </div>`
            : ''
        }
        <section aria-label=${t('members.summary')} class="card shadow-sm mb-4">
          <div class="card-body p-4">
            <dl class="member-state row g-4 mb-0">
              <div class="col-md-6 col-lg-3">
                <dt class="small text-body-secondary fw-normal mb-1">${t('members.statusLabel')}</dt>
                <dd class="mb-0"><span class="badge rounded-pill ${
                  page.member.status === 'registered'
                    ? 'text-bg-success'
                    : blocked || page.member.status === 'registration-failed'
                      ? 'text-bg-danger'
                      : 'text-bg-secondary'
                }">${memberText('statuses', page.member.status)}</span></dd>
              </div>
              <div class="col-md-6 col-lg-3">
                <dt class="small text-body-secondary fw-normal mb-1">${t('members.student')}</dt>
                <dd class="mb-0 text-break"><a href="/students/${page.member.studentNumber}">${page.member.name}</a></dd>
              </div>
              <div class="col-md-6 col-lg-3">
                <dt class="small text-body-secondary fw-normal mb-1">${t('members.email')}</dt>
                <dd class="mb-0 text-break" dir="auto">${page.member.email}</dd>
              </div>
              <div class="col-md-6 col-lg-3">
                <dt class="small text-body-secondary fw-normal mb-1">${t('members.enteredAt')}</dt>
                <dd class="mb-0"><${MemberDate} timestamp=${page.member.enteredAt} /></dd>
              </div>
              ${
                page.member.reasonCode
                  ? html`<div class="col-md-4">
                      <dt class="small text-body-secondary fw-normal mb-1">
                        ${t('members.reason')}
                      </dt>
                      <dd class="mb-0">${memberText('reasons', page.member.reasonCode)}</dd>
                    </div>`
                  : ''
              }
              ${
                page.member.reasonText
                  ? html`<div class="col-md-8">
                      <dt class="small text-body-secondary fw-normal mb-1">
                        ${t('members.reasonText')}
                      </dt>
                      <dd class="mb-0 text-break">${page.member.reasonText}</dd>
                    </div>`
                  : ''
              }
              ${
                page.member.registrationEmailSentAt
                  ? html`<div class="col-md-4">
                      <dt class="small text-body-secondary fw-normal mb-1">
                        ${t('members.emailSentAt')}
                      </dt>
                      <dd class="mb-0">
                        <${MemberDate} timestamp=${page.member.registrationEmailSentAt} />
                      </dd>
                    </div>`
                  : ''
              }
            </dl>
          </div>
        </section>
        <div class="row g-4 mb-4">
        <div class=${page.readOnly ? 'col-12' : 'col-lg-6'}>
        <form aria-labelledby="member-roles-heading" hx-put="${base}/roles" hx-target="body" hx-disabled-elt="find button" class="member-roles card shadow-sm h-100">
          <input type="hidden" name="expectedHistoryId" value=${rolesView?.expectedHistoryId ?? page.member.historyId} />
          <div class="card-body p-4">
          <h3 id="member-roles-heading" class="fs-5 fw-semibold mb-3">${t('members.roleLabel')}</h3>
          <fieldset aria-labelledby="member-roles-heading" disabled=${page.readOnly || blocked}>
            <${MemberRolesFields} view=${displayedRoles} />
            ${page.readOnly || blocked ? '' : html`<button class="btn btn-primary mt-2" type="submit">${t('members.saveRoles')}</button>`}
          </fieldset>
          </div>
        </form>
        </div>
        ${
          page.readOnly
            ? ''
            : html`<div class="col-lg-6">
                <form
                  aria-labelledby="member-actions-heading"
                  hx-post="${base}/actions"
                  hx-target="body"
                  class="member-actions card shadow-sm h-100"
                  hx-disabled-elt="find button"
                >
                  <div class="card-body p-4">
                    <h3 id="member-actions-heading" class="fs-5 fw-semibold mb-3">
                      ${t('members.actionsLabel')}
                    </h3>
                    <input
                      type="hidden"
                      name="expectedHistoryId"
                      value=${actionView?.expectedHistoryId ?? page.member.historyId}
                    />
                    <label class="form-label text-body-secondary small" for="member-action-reason"
                      >${t('members.actionReason')}</label
                    >
                    <textarea
                      id="member-action-reason"
                      name="reasonText"
                      class="form-control mb-3"
                      rows="3"
                    >
${actionView?.reasonText ?? ''}</textarea>
                    <div class="d-flex flex-wrap gap-2">
                      ${page.actions.map(
                        (action) =>
                          html` <button
                            type="submit"
                            class="btn ${
                              ['block', 'reject', 'unregister-self', 'unregister-removed'].includes(
                                action,
                              )
                                ? 'btn-outline-danger'
                                : action === 'cancel'
                                  ? 'btn-outline-secondary'
                                  : 'btn-primary'
                            }"
                            name="action"
                            value=${action}
                          >
                            ${memberText('actions', action)}
                          </button>`,
                      )}
                    </div>
                  </div>
                </form>
              </div>`
        }
        </div>
        <h5 id="member-history-heading" class="mt-3 col-md-6 border-bottom">${t('members.history')}</h5>
        <ul aria-labelledby="member-history-heading" class="member-history list-group mt-3 pb-3 col-md-6" style="font-size: 0.9rem">
          ${page.history.map(
            (entry) =>
              html`<li class="list-group-item d-flex" style="text-transform: capitalize;">
                ${
                  entry.historyId === page.member.historyId
                    ? html`<strong class="d-block"
                        >${memberText('operations', entry.operation)}</strong
                      >`
                    : html`<a
                        class="d-block"
                        href=${entry.historyId === page.currentHistoryId ? base : `${base}/by-history/${entry.historyId}`}
                        >${memberText('operations', entry.operation)}</a
                      >`
                }
                <span class="ms-3">${entry.operationReason}</span>
                <time
                  class="d-block ms-auto"
                  datetime=${entry.timestamp}
                  title=${new Date(entry.timestamp).toLocaleTimeString('he-IL')}
                  >${new Date(entry.timestamp).toLocaleDateString('he-IL')}</time
                >
              </li>`,
          )}
        </ul>
        </div>
      </${Layout}>
    </${MainLayout}>
  `
}

function MemberDate({timestamp}: {timestamp: string}) {
  const date = new Date(timestamp)
  return html`<time datetime=${timestamp} title=${date.toLocaleTimeString(`${i18next.language}-IL`)}
    >${date.toLocaleDateString(`${i18next.language}-IL`)}</time
  >`
}

export function renderAddMemberPage({
  communityNumber,
  communityName,
  view = {
    studentNumber: '',
    poster: 'on',
    liveStreamer: '',
    moderator: '',
    userBlocker: '',
    userApprover: '',
  },
  selected,
  banner,
}: {
  communityNumber: number
  communityName: string
  view?: NewMemberView
  selected?: StudentChoiceView
  banner?: Banner
}): string | string[] {
  const base = `/communities/${communityNumber}/members`
  return html`
    <${MainLayout} title=${t('members.add')} activeNavItem="communities" banner=${banner}>
      <${Layout}>
        <div class="member-detail col-xl-10 mx-auto py-4">
          <header class="mb-4">
            <${MemberBreadcrumbs} communityNumber=${communityNumber} communityName=${communityName} current=${t('members.add')} />
            <p class="text-body-secondary small mb-1">${t('members.membership')}</p>
            <h2 class="mb-0">${t('members.add')}</h2>
          </header>
          <form aria-label=${t('members.add')} hx-post="${base}/new" hx-target="body" hx-disabled-elt="find button[type=submit]">
            <section aria-label=${t('members.summary')} class="card shadow-sm mb-4">
              <div class="card-body p-4">
                <div id="member-student-field"
                  hx-on::after-swap="if (event.target === this) document.getElementById('member-student-dialog').close()">
                  <${MemberStudentSelection} input=${view.studentNumber} selected=${selected} />
                </div>
                <div class="row g-3 mt-2 pt-3 border-top">
                  <div class="col-md-6">
                    <span class="d-block text-body-secondary small mb-1">${t('members.statusLabel')}</span>
                    <span class="badge rounded-pill text-bg-secondary">${memberText('statuses', 'started-registration')}</span>
                  </div>
                  <div class="col-md-6">
                    <span class="d-block text-body-secondary small mb-1">${t('members.enteredAt')}</span>
                    <span class="text-body-secondary">${t('members.dateOnAdd')}</span>
                  </div>
                </div>
              </div>
            </section>
            <div class="row g-4">
              <div class="col-lg-6">
                <section class="card shadow-sm h-100">
                  <div class="card-body p-4">
                    <h3 id="member-roles-heading" class="fs-5 fw-semibold mb-3">${t('members.roleLabel')}</h3>
                    <fieldset aria-labelledby="member-roles-heading">
                      <${MemberRolesFields} view=${view} />
                    </fieldset>
                  </div>
                </section>
              </div>
              <div class="col-lg-6">
                <section aria-labelledby="member-add-actions-heading" class="card shadow-sm h-100">
                  <div class="card-body p-4">
                    <h3 id="member-add-actions-heading" class="fs-5 fw-semibold mb-3">${t('members.actionsLabel')}</h3>
                    <p class="text-body-secondary">${t('members.addHelp')}</p>
                    <div class="d-flex flex-wrap gap-2">
                      <button type="submit" class="btn btn-primary">${t('members.add')}</button>
                      <a class="btn btn-outline-secondary" href=${base}>${t('members.cancel')}</a>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </form>
          <dialog id="member-student-dialog" class="member-student-dialog" aria-labelledby="member-student-dialog-heading">
            <div id="member-student-dialog-content">
              <${MemberStudentDialog} communityNumber=${communityNumber} />
            </div>
          </dialog>
        </div>
      </${Layout}>
    </${MainLayout}>
  `
}

function MemberStudentSelection({
  selected,
  input = '',
}: {
  selected?: StudentChoiceView
  input?: string
}) {
  return html`<div class="row g-3">
    <div class="col-md-8">
      <label class="form-label text-body-secondary small" for="member-student"
        >${t('members.student')}</label
      >
      <div class="input-group">
        <input
          id="member-student"
          name="studentNumber"
          class="form-control"
          required
          value=${selected ? generateItemTitle(selected.studentNumber, selected.name) : input}
          oninput="document.getElementById('member-student-email').value = ''"
        />
        <button
          type="button"
          class="btn btn-outline-secondary"
          onclick="document.getElementById('member-student-dialog').showModal()"
        >
          ${t('members.searchCreate')}
        </button>
      </div>
    </div>
    <div class="col-md-4">
      <label class="form-label text-body-secondary small" for="member-student-email"
        >${t('members.email')}</label
      >
      <input
        id="member-student-email"
        class="form-control-plaintext"
        type="text"
        readonly
        value=${selected?.email ?? ''}
      />
    </div>
  </div>`
}

export function renderMemberStudentSelection(selected: StudentChoiceView): string | string[] {
  return html`<${MemberStudentSelection} selected=${selected} />`
}

function MemberStudentDialog({
  communityNumber,
  student = {firstName: '', lastName: '', email: '', phone: ''},
  banner,
}: {
  communityNumber: number
  student?: NewMemberStudentView
  banner?: Banner
}) {
  const base = `/communities/${communityNumber}/members`
  return html`
    <h3 id="member-student-dialog-heading" class="fs-5 mb-3">${t('members.searchCreate')}</h3>
    ${banner ? html`<${BannerComponent} banner=${banner} />` : ''}
    <form
      role="search"
      aria-label=${t('members.search')}
      hx-get="${base}/student-search"
      hx-target="#member-student-search-results"
      hx-trigger="input changed delay:500ms from:input, submit"
      class="mb-3"
    >
      <label class="form-label" for="member-student-query">${t('members.search')}</label>
      <div class="input-group">
        <input
          id="member-student-query"
          type="search"
          name="q"
          class="form-control"
          placeholder=${t('members.searchPlaceholder')}
          autofocus
        />
        <button type="submit" class="btn btn-outline-secondary">${t('members.search')}</button>
      </div>
    </form>
    <div id="member-student-search-results" aria-live="polite"></div>
    <hr />
    <details open=${!!banner}>
      <summary id="member-create-student-heading" class="mb-3 fw-semibold">
        ${t('members.createStudent')}
      </summary>
      <form
        aria-labelledby="member-create-student-heading"
        hx-post="${base}/student-create"
        hx-target="#member-student-dialog-content"
        hx-swap="innerHTML"
        hx-disabled-elt="find button"
      >
        <div class="row g-3 mb-3">
          ${(['firstName', 'lastName', 'email', 'phone'] as const).map(
            (field) =>
              html`<div class="col-sm-6">
                <label class="form-label" for="member-create-${field}"
                  >${memberText('fields', field)}</label
                >
                <input
                  id="member-create-${field}"
                  class="form-control"
                  name=${field}
                  type=${field === 'email' ? 'email' : 'text'}
                  value=${student[field]}
                  required=${field !== 'phone'}
                />
              </div>`,
          )}
        </div>
        <button type="submit" class="btn btn-primary">${t('members.createAndSelect')}</button>
      </form>
    </details>
    <div class="d-flex justify-content-end mt-3">
      <button type="button" class="btn btn-secondary" onclick="this.closest('dialog').close()">
        ${t('members.cancel')}
      </button>
    </div>
  `
}

export function renderMemberStudentDialog(
  communityNumber: number,
  options: {student?: NewMemberStudentView; banner?: Banner} = {},
): string | string[] {
  return html`<${MemberStudentDialog} communityNumber=${communityNumber} ...${options} />`
}

export function renderMemberStudentResults(
  communityNumber: number,
  students: StudentChoiceView[],
): string | string[] {
  if (!students.length) return html`<p class="text-body-secondary">${t('members.noResults')}</p>`
  return html`<ul aria-label=${t('members.searchResults')} class="list-group">
    ${students.map(
      (student) =>
        html`<li class="list-group-item d-flex flex-wrap align-items-center gap-3">
          <div class="me-auto text-break">
            <strong>${student.name}</strong>
            <small class="d-block text-body-secondary">${student.email}</small>
          </div>
          <button
            type="button"
            class="btn btn-outline-primary btn-sm"
            aria-label="${t('members.select')} ${student.name}"
            hx-get="/communities/${communityNumber}/members/student-selection?studentNumber=${student.studentNumber}"
            hx-target="#member-student-field"
            hx-swap="innerHTML"
          >
            ${t('members.select')}
          </button>
        </li>`,
    )}
  </ul>`
}
