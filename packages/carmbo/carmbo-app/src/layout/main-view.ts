import {BannerComponent, type Banner} from './banner.ts'
import {html} from '../commons/html-templates.ts'
import {version} from '../commons/version.ts'
import i18next, {getFixedT} from 'i18next'

const t = getFixedT(null, 'layout')

export function MainLayout({
  title,
  banner,
  children,
  activeNavItem,
}: {
  title: string
  banner?: Banner
  children: string[]
  activeNavItem: 'no-nav-bar' | 'students' | 'products' | 'sales-events' | 'sales' | 'jobs'
}) {
  const dir = i18next.dir()

  return (
    '<!DOCTYPE html>' +
    html`
      <html lang="${i18next.language}" dir="${dir}">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link
            rel="stylesheet"
            href=${`/dist/${version}/bootstrap.${dir === 'rtl' ? 'rtl.' : ''}min.css`}
          />
          <link rel="stylesheet" href=${`/src/${version}/layout/style/style.css`} />
          <script src=${`/dist/${version}/htmx.min.js`}></script>
          <script src=${`/dist/${version}/bootstrap.bundle.min.js`} defer></script>
          <script src=${`/src/${version}/layout/js/scripts.js`} type="module"></script>
          <title>${title}</title>
        </head>
        <body>
          <div class="layouts-main-view">
            <header class="container">
              ${activeNavItem !== 'no-nav-bar' &&
              html`<${NavBar} activeNavItem=${activeNavItem} />`}
            </header>
            <main class="container">${children}</main>
            <div id="banner-container">
              ${banner
                ? html`<${BannerComponent} banner=${banner}></${BannerComponent}>`
                : undefined}
            </div>
          </div>
        </body>
      </html>
    `
  )
}

function NavBar({
  activeNavItem,
}: {
  activeNavItem: 'students' | 'products' | 'sales-events' | 'sales' | 'jobs'
}) {
  return html`
    <nav class="navbar navbar-expand-sm bg-body-tertiary">
      <div class="container-fluid">
        <a class="navbar-brand" href="/"
          ><img
            src=${`/src/${version}/layout/style/carmel-egger-icon.png`}
            width="30"
            height="30"
            alt="Carmel Egger Logo"
        /></a>
        <button
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#layouts-main-view_navbarSupportedContent"
          aria-controls="layouts-main-view_navbarSupportedContent"
          aria-expanded="false"
          aria-label=${t('nav.toggleNavigation')}
        >
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="layouts-main-view_navbarSupportedContent">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li class="nav-item" role="menuitem">
              <a
                class="nav-link ${activeNavItem === 'students' ? 'active' : ''}"
                href="/students"
                aria-current="page"
                >${t('nav.students')}</a
              >
            </li>
            <li class="nav-item" role="menuitem">
              <a class="nav-link ${activeNavItem === 'products' ? 'active' : ''}" href="/products"
                >${t('nav.products')}</a
              >
            </li>
            <li class="nav-item">
              <a
                class="nav-link ${activeNavItem === 'sales-events' ? 'active' : ''}"
                href="/sales-events"
                >${t('nav.salesEvents')}</a
              >
            </li>
            <li class="nav-item" role="menuitem">
              <a class="nav-link ${activeNavItem === 'sales' ? 'active' : ''}" href="/sales"
                >${t('nav.sales')}</a
              >
            </li>
            <li class="nav-item" role="menuitem">
              <a class="nav-link ${activeNavItem === 'jobs' ? 'active' : ''}" href="/jobs"
                >${t('nav.jobs')}</a
              >
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `
}
