import {html} from '../commons/html-templates.ts'

export function MainLayout({
  title,
  flash,
  children,
  activeNavItem,
}: {
  title: string
  flash?: string
  children: string[]
  activeNavItem: 'students' | 'products' | 'sales-events' | 'sales'
}) {
  return (
    '<!DOCTYPE html>' +
    html`
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="stylesheet" href="/public/layouts/common-style/style.css" />
          <link rel="stylesheet" href="/third-party/bootstrap.min.css" />
          <script src="/third-party/bootstrap.bundle.min.js" defer></script>
          <script src="/third-party/htmx.min.js" defer></script>
          <title>${title}</title>
        </head>
        <body>
          <div class="layouts-main-view">
            <header class="container"><${NavBar} activeNavItem=${activeNavItem} /></header>
            <main class="container">
              ${flash ? `<section class="flash" >${flash}</section>` : ''} ${children}
            </main>
          </div>
        </body>
      </html>
    `
  )
}

function NavBar({
  activeNavItem,
}: {
  activeNavItem: 'students' | 'products' | 'sales-events' | 'sales'
}) {
  return html`
    <nav class="navbar navbar-expand-sm bg-body-tertiary">
      <div class="container-fluid">
        <a class="navbar-brand" href="/"
          ><img
            src="/public/layouts/common-style/carmel-egger-icon.png"
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
              <a
                class="nav-link ${activeNavItem === 'students' ? 'active' : ''}"
                href="/students"
                aria-current="page"
                >Students</a
              >
            </li>
            <li class="nav-item">
              <a class="nav-link ${activeNavItem === 'products' ? 'active' : ''}" href="/products"
                >Products</a
              >
            </li>
            <li class="nav-item">
              <a
                class="nav-link ${activeNavItem === 'sales-events' ? 'active' : ''}"
                href="/sales-events"
                >Sales events</a
              >
            </li>
            <li class="nav-item">
              <a class="nav-link ${activeNavItem === 'sales' ? 'active' : ''}" href="/sales"
                >Sales</a
              >
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `
}
