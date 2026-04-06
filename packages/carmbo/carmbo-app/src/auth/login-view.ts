import {html} from '../commons/html-templates.ts'
import {version} from '../commons/version.ts'
import i18next from 'i18next'

export function LoginPage({error}: {error?: string}) {
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
          <title>Login</title>
        </head>
        <body class="bg-light">
          <div class="container">
            <div class="row justify-content-center mt-5">
              <div class="col-md-4">
                <div class="card shadow-sm">
                  <div class="card-body">
                    <h3 class="card-title text-center mb-4">Login</h3>
                    ${error
                      ? html`<div class="alert alert-danger" role="alert">${error}</div>`
                      : undefined}
                    <form method="POST" action="/auth/login">
                      <div class="mb-3">
                        <label for="email" class="form-label">Email</label>
                        <input
                          type="email"
                          class="form-control"
                          id="email"
                          name="email"
                          required
                          autofocus
                        />
                      </div>
                      <div class="mb-3">
                        <label for="password" class="form-label">Password</label>
                        <input
                          type="password"
                          class="form-control"
                          id="password"
                          name="password"
                          required
                        />
                      </div>
                      <button type="submit" class="btn btn-primary w-100">Login</button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  )
}
