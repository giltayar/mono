import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {getFixedT} from 'i18next'

const t = getFixedT(null, 'community')

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src="/communities/scripts.js" defer></script>
    <link rel="stylesheet" href="/communities/style.css" />
    <div class="communities-view">${children}</div>
  `
}

export function CommunityTabs({
  communityNumber,
  activeTab,
}: {
  communityNumber: number
  activeTab: 'details' | 'members'
}) {
  return html`
    <nav aria-label=${t('tabs.navigation')}>
      <ul class="nav nav-tabs community-tabs col-md-6">
        <li class="nav-item">
          <a
            class="nav-link"
            aria-current=${activeTab === 'details' ? 'page' : undefined}
            href="/communities/${communityNumber}"
            >${t('tabs.details')}</a
          >
        </li>
        <li class="nav-item">
          <a
            class="nav-link"
            aria-current=${activeTab === 'members' ? 'page' : undefined}
            href="/communities/${communityNumber}/members"
            >${t('tabs.members')}</a
          >
        </li>
      </ul>
    </nav>
  `
}
