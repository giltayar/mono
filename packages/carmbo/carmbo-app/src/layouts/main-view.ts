import {html} from '../commons/html-templates.ts'

export function MainLayout({
  title,
  flash,
  children,
}: {
  title: string
  flash?: string
  children: string[]
}) {
  return (
    '<!DOCTYPE html>' +
    html`
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="stylesheet" href="/public/styles.css" />
          <script src="/public/htmx.min.js" defer></script>
          <script src="/public/scripts.js" defer></script>
          <title>${title}</title>
        </head>
        <body>
          ${flash ? `<section class="flash" >${flash}</section>` : ''} ${children}
        </body>
      </html>
    `
  )
}
