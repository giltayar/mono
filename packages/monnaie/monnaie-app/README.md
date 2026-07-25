# monnaie-app

A mobile-first web app that tracks expenses.

## Stack

- **Fastify** for the server, with routes under `src/domain/<domain>/route.ts`
- **HTMX** for interactivity, so there is (almost) no frontend JavaScript
- **htm** + **vhtml** for server-side rendering of HTML in TypeScript
- **TypeScript**, running natively in Node.js (no transpilation)
- **Playwright** for integration tests, with page object models in `test/page-model`

## Running

```sh
pnpm build   # copies htmx into `dist`
pnpm start   # runs the app on http://localhost:3000
```

## Testing

```sh
pnpm test    # eslint + typescript + playwright
```
