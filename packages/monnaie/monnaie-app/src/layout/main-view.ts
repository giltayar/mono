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
  styleSheet,
  script,
  children,
}: {
  title: string
  heading: string
  headingHref?: string
  headingOnClick?: string
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
          <meta name="color-scheme" content="light dark" />
          <meta name="htmx-config" content=${HTMX_CONFIG} />
          <link rel="stylesheet" href=${`/src/${version}/layout/style/style.css`} />
          ${styleSheet && html`<link rel="stylesheet" href=${`/src/${version}/${styleSheet}`} />`}
          <script src=${`/dist/${version}/htmx.min.js`}></script>
          ${script && html`<script type="module" src=${`/src/${version}/${script}`}></script>`}
          <title>${title}</title>
        </head>
        <body>
          <main class="main-view">
            <header class="main-header">
              <h1>
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
