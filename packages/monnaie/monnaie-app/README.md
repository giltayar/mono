# monnaie-app

A mobile-first web app that tracks expenses.

## Stack

- **Fastify** for the server, with routes under `src/domain/<domain>/route.ts`
- **HTMX** for interactivity, so there is (almost) no frontend JavaScript
- **htm** + **vhtml** for server-side rendering of HTML in TypeScript
- **Firebase Authentication** for signing in, with a server-side session cookie
- **TypeScript**, running natively in Node.js (no transpilation)
- **Playwright** for integration tests, with page object models in `test/page-model`

## Running

```sh
pnpm build   # copies htmx and bundles the login script into `dist`
pnpm start   # runs the app on http://localhost:3000
```

### Environment variables

| Variable                                | Required | Description                                                       |
| --------------------------------------- | -------- | ----------------------------------------------------------------- |
| `DB_CONNECTION_STRING`                  | no       | Defaults to the local docker compose postgres                     |
| `LANGUAGE`                              | no       | The language to fall back to. `en` (default) or `he`              |
| `MONNAIE_FIREBASE_SERVICE_ACCOUNT_JSON` | yes      | The firebase service account JSON, as downloaded from the console |
| `MONNAIE_FIREBASE_API_KEY`              | yes      | The firebase web API key. Public, and served to the browser       |
| `SECURE_COOKIES`                        | no       | `true` by default; only turn it off when serving over plain http  |

## Testing

```sh
pnpm test    # eslint + typescript + node unit tests + playwright integration tests
```

The integration tests inject a fake identity provider, so they need no firebase credentials. The
e2e tests sign in for real and refuse to run without `MONNAIE_FIREBASE_SERVICE_ACCOUNT_JSON`,
`MONNAIE_FIREBASE_API_KEY`, `MONNAIE_E2E_EMAIL`, and `MONNAIE_E2E_PASSWORD`:

```sh
pnpm build && pnpm test:e2e
```
