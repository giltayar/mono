import {html} from '../commons/html-templates.ts'
import {currentDirection, currentLanguage} from '../commons/i18n.ts'
import {version} from '../commons/version.ts'
import {UserMenu} from './user-menu.ts'

/**
 * A form that fails validation is answered with `400` and with the form itself, re-rendered with
 * the message — so that response is worth swapping, even though htmx refuses to swap a `4xx` by
 * default. The rest of the list is htmx's own default, which has to be repeated because the
 * setting replaces it, and the order matters: the first matching entry wins.
 */
const HTMX_CONFIG = JSON.stringify({
  responseHandling: [
    {code: '204', swap: false},
    {code: '[23]..', swap: true},
    {code: '400', swap: true, error: false},
    {code: '[45]..', swap: false, error: true},
  ],
})

export function MainLayout({
  title,
  heading,
  headingHref,
  headingOnClick,
  headingViewTransitionName,
  styleSheet,
  script,
  children,
}: {
  title: string
  heading: string
  headingHref?: string
  headingOnClick?: string
  headingViewTransitionName?: string
  /** Path of an additional stylesheet, relative to `src` */
  styleSheet?: string
  /** Path of a client-side ES module, relative to `src` */
  script?: string
  children: string[]
}): string {
  return (
    '<!DOCTYPE html>' +
    html`
      <html lang=${currentLanguage()} dir=${currentDirection()}>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="color-scheme" content="light" />
          <meta name="theme-color" content="#19724c" />
          <meta name="description" content="A mobile-first web app that tracks expenses" />
          <meta name="application-name" content="Monnaie" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Monnaie" />
          <meta name="htmx-config" content=${HTMX_CONFIG} />
          <link rel="manifest" href=${`/src/${version}/pwa/manifest.webmanifest`} />
          <link rel="icon" href=${`/src/${version}/pwa/icons/icon.svg`} type="image/svg+xml" />
          <link rel="apple-touch-icon" href=${`/src/${version}/pwa/icons/apple-touch-icon.png`} />
          <link rel="stylesheet" href=${`/src/${version}/layout/style/style.css`} />
          ${styleSheet && html`<link rel="stylesheet" href=${`/src/${version}/${styleSheet}`} />`}
          <script src=${`/dist/${version}/htmx.min.js`}></script>
          <script type="module" src=${`/src/${version}/layout/client/pwa-install.js`}></script>
          ${script && html`<script type="module" src=${`/src/${version}/${script}`}></script>`}
          <title>${title}</title>
        </head>
        <body>
          <main class="main-view">
            <header class="main-header">
              <h1
                style=${
                  headingViewTransitionName === undefined
                    ? undefined
                    : `view-transition-name: ${headingViewTransitionName}`
                }
              >
                ${
                  headingHref === undefined
                    ? heading
                    : html`<a href=${headingHref} hx-on:click=${headingOnClick}>${heading}</a>`
                }
              </h1>
              <${UserMenu} />
            </header>
            ${children}
          </main>
        </body>
      </html>
    `
  )
}
