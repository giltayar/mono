import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {MainLayout} from '@giltayar/carmbo-commons/layout/main-view'
import type {Banner} from '@giltayar/carmbo-commons/layout/banner'
import {getFixedT} from 'i18next'
import {CommunityCreateView, CommunityHistoryView, CommunityUpdateView} from './create-update.ts'
import {Layout} from './layout.ts'
import type {CommunityPageView, CommunityView} from './model.ts'

const t = getFixedT(null, 'community')

export function renderCommunityCreatePage(
  community: CommunityView | undefined,
  {banner}: {banner?: Banner} = {},
): string | string[] {
  return html`
    <${MainLayout} title=${t('list.communities')} activeNavItem="communities" banner=${banner}>
      <${Layout}>
        <${CommunityCreateView} community=${community ?? {name: '', description: ''}} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderCommunityUpdatePage(
  page: CommunityPageView,
  {banner}: {banner?: Banner} = {},
): string | string[] {
  return html`
    <${MainLayout} title=${t('list.communities')} activeNavItem="communities" banner=${banner}>
      <${Layout}>
        <${CommunityUpdateView} page=${page} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderCommunityViewInHistoryPage(page: CommunityPageView): string | string[] {
  return html`
    <${MainLayout} title=${t('list.communities')} activeNavItem="communities">
      <${Layout}>
        <${CommunityHistoryView} page=${page} />
      </${Layout}>
    </${MainLayout}>
  `
}
