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
          <link rel="stylesheet" href="/public/layouts/main-view.css" />
          <link rel="stylesheet" href="/third-party/bootstrap.min.css" />
          <script src="/third-party/bootstrap.bundle.min.js" defer></script>
          <script src="/third-party/htmx.min.js" defer></script>
          <script src="/public/layouts/main-view.scripts.js" type="module"></script>
          <title>${title}</title>
        </head>
        <body>
          <div class="layouts-main-view">
            <header class="container"><${NavBar} /></header>
            <main class="container">
              ${flash ? `<section class="flash" >${flash}</section>` : ''} ${children}
            </main>
          </div>
        </body>
      </html>
    `
  )
}

function NavBar() {
  return html`
    <nav class="navbar navbar-expand-sm bg-body-tertiary">
      <div class="container-fluid">
        <a class="navbar-brand" href="/"
          ><img
            src="/public/layouts/carmel-egger-icon.png"
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
          aria-label="Toggle navigation"
        >
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="layouts-main-view_navbarSupportedContent">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">
            <li class="nav-item">
              <a class="nav-link active" href="/students" aria-current="page">Students</a>
            </li>
            <li class="nav-item"><a class="nav-link" href="/courses">Courses</a></li>
            <li class="nav-item">
              <a class="nav-link" href="/lessons">Sales events</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `
}
