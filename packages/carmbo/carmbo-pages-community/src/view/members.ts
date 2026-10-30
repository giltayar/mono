import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {MainLayout} from '@giltayar/carmbo-commons/layout/main-view'
import {getVersion} from '@giltayar/carmbo-commons/commons/version'
import {getFixedT, default as i18next} from 'i18next'
import {Layout, CommunityTabs} from './layout.ts'
import type {MemberListView, MemberView} from './member-model.ts'
import {memberText, roles} from './member-text.ts'

const t = getFixedT(null, 'community')

function RoleSummary({member}: {member: MemberView}) {
  return [
    t('members.roles.viewer'),
    ...roles.filter((role) => member[role]).map((role) => memberText('roles', role)),
  ].join(', ')
}

export function renderMembersPage(list: MemberListView): string | string[] {
  return html`
    <${MainLayout} title=${t('members.title')} activeNavItem="communities">
      <${Layout}>
        <h2 class="border-bottom col-md-6 mt-3">${list.communityName}
          ${list.readOnly ? html`<small class="text-body-secondary">${t('createUpdate.archived')}</small>` : ''}
        </h2>
        <${CommunityTabs} communityNumber=${list.communityNumber} activeTab="members" />
        <${MemberList} list=${list} />
      </${Layout}>
    </${MainLayout}>
  `
}

function MemberList({list}: {list: MemberListView}) {
  const base = `/communities/${list.communityNumber}/members`
  return html`
    <section aria-label=${t('members.title')} class="members mt-3">
      <div class="title-and-search d-flex flex-row border-bottom align-items-baseline">
        <h2>${t('members.title')}</h2>
        <form
          role="search"
          aria-label=${t('members.title')}
          class="member-search mb-1 ms-auto"
          action=${base}
          method="get"
          hx-get=${base}
          hx-target=".member-list"
          hx-select=".member-list"
          hx-include="this"
          hx-trigger="input changed delay:500ms from:input[type=search]"
          hx-push-url="true"
          hx-swap="outerHTML"
        >
          <fieldset class="row align-items-center me-0">
            <label class="form-input-label col-auto" for="member-query">${t('list.search')}</label>
            <input
              type="search"
              name="q"
              id="member-query"
              class="form-control form-control-sm col"
              placeholder=${t('list.searchPlaceholder')}
              value=${list.query}
            />
          </fieldset>
        </form>
      </div>
      <table aria-label=${t('members.title')} class="table member-list mt-3">
        <thead>
          <tr>
            <th>${t('list.id')}</th>
            <th>${t('members.member')}</th>
            <th>${t('members.email')}</th>
            <th>${t('members.enteredAt')}</th>
            <th>${t('members.roleLabel')}</th>
            <th>${t('members.statusLabel')}</th>
            <th>${t('members.reason')}</th>
          </tr>
        </thead>
        <tbody>
          ${list.members.map(
            (member, i, members) =>
              html` <tr
                data-student-number=${member.studentNumber}
                ...${
                  i === members.length - 1
                    ? {
                        'hx-get': `${base}?page=${list.page + 1}`,
                        'hx-trigger': 'revealed',
                        'hx-select': '.member-list tbody tr',
                        'hx-include': '.member-search',
                        'hx-swap': 'afterend',
                      }
                    : {}
                }
              >
                <td>
                  <a
                    class="btn btn-light btn-sm"
                    role="button"
                    href="${base}/${member.studentNumber}"
                    >${member.studentNumber}</a
                  >
                </td>
                <td><a href="/students/${member.studentNumber}">${member.name}</a></td>
                <td>${member.email}</td>
                <td>
                  <time
                    datetime=${member.enteredAt}
                    title=${new Date(member.enteredAt).toLocaleTimeString(`${i18next.language}-IL`)}
                    >${new Date(member.enteredAt).toLocaleDateString(`${i18next.language}-IL`)}</time
                  >
                </td>
                <td><${RoleSummary} member=${member} /></td>
                <td>${memberText('statuses', member.status)}</td>
                <td>
                  ${member.reasonCode ? memberText('reasons', member.reasonCode) : ''}
                  ${member.reasonText}
                </td>
              </tr>`,
          )}
        </tbody>
      </table>
      ${
        list.readOnly
          ? ''
          : html` <section class="add-new">
              <a
                role="button"
                class="btn float-end"
                href="${base}/new"
                aria-label=${t('members.add')}
              >
                <object
                  type="image/svg+xml"
                  class="feather feather-large"
                  data=${`/src/${getVersion()}/layout/style/plus-circle.svg`}
                ></object>
              </a>
            </section>`
      }
    </section>
  `
}
