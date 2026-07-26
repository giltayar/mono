import {html} from '../commons/html-templates.ts'
import {currentDirection, currentLanguage} from '../commons/i18n.ts'
import {version} from '../commons/version.ts'
import {LanguageSwitcher} from './language-switcher.ts'

export function MainLayout({
  title,
  styleSheet,
  children,
}: {
  title: string
  /** Path of an additional stylesheet, relative to `src` */
  styleSheet?: string
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
          <link rel="stylesheet" href=${`/src/${version}/layout/style/style.css`} />
          ${styleSheet && html`<link rel="stylesheet" href=${`/src/${version}/${styleSheet}`} />`}
          <script src=${`/dist/${version}/htmx.min.js`}></script>
          <title>${title}</title>
        </head>
        <body>
          <main class="main-view">
            <${LanguageSwitcher} />
            ${children}
          </main>
        </body>
      </html>
    `
  )
}
