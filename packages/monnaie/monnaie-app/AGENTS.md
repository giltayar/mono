# monnaie-app — agent instructions

These are package-specific instructions. The monorepo-wide rules (ESM, `tsgo`, prettier, package
independence, etc.) live in the root `AGENTS.md` and also apply here.

## Architecture

Layers, strictly in this order — a layer may only import from the ones below it:

1. `src/domain/<domain>/route.ts` — **HTTP only**: zod schemas for the request, then delegate.
   Registered as a fastify plugin, receives `{db}` as options. Ends every handler with
   `replyWithControllerResult(reply, await someController(db, ...))`.
2. `src/domain/<domain>/controller.ts` — the only layer that knows both the model and the views.
   Every controller returns `Promise<ControllerResult>` (`src/commons/controller.ts`):
   `{html, statusCode?, headers?}`, where `headers` carries HTMX headers such as `HX-Trigger`.
3. `src/domain/<domain>/model.ts` — pure logic + data access (kysely queries). No HTML, no fastify.
4. `src/domain/<domain>/view/view.ts` — htm + vhtml rendering, wrapped in `src/layout/main-view.ts`.
   Domain CSS lives in `src/domain/<domain>/view/style/style.css` and is served from source.

`src/app/monnaie-app.ts` exports `makeApp({connectionString})` returning `{app, db}`; it is the only
place that wires fastify, the zod type provider, static serving, and the routes.
`src/app/index.ts` parses env vars with zod, runs migrations, and listens.

## HTMX conventions

- Server responses are HTML fragments; out-of-band swaps (`hx-swap-oob`) update the history section
  when a calculation succeeds.
- Client-side side effects (like clearing the input) are driven by an `HX-Trigger` response header
  plus `hx-on:<event>` on the element — *not* by returning a new `<input>`. This keeps the response
  about data and lets the browser own transient UI state (focus, selection).

## Views and CSS

- HTML is rendered server-side with **htm + vhtml**, through `html` from
  `src/commons/html-templates.ts`. vhtml marks the strings it returns as sanitized, so nested
  components compose without double-escaping while interpolated *values* are still escaped.
- `html` returns `string | string[]` (an array when a template has several roots), so view functions
  that declare `: string` end their template with `` ` as string``.
- htm's types ship as CJS (`dist/htm.d.ts`) while ESM resolves to `dist/htm.mjs`, so TypeScript
  types the default import as the module namespace and `htm.bind` appears to be missing. That is why
  `html-templates.ts` carries a `//@ts-expect-error`; `esModuleInterop` does **not** fix it.
- `MainLayout({title, styleSheet, children})` — `styleSheet` is a path **relative to `src`**
  (e.g. `domain/calculator/view/style/style.css`) and, when given, adds a second
  `<link rel="stylesheet">`. Domain views never build asset hrefs themselves.
- Assets are served versioned and immutable: `/dist/<version>/...` for built client assets and
  `/src/<version>/...` for source `.css`/`.js` only. `version` comes from `package.json`, so bumping
  the version busts the cache.
- CSS is hand-written and **mobile-first** — no bootstrap or other CSS framework, and no BEM class
  naming. Use scoped selectors (`#calculation-form input`) with **native CSS nesting**. Shared
  tokens (`--spacing`, `--radius`, `--border-color`) live in `src/layout/style/style.css`; anything
  domain-specific goes in that domain's `view/style/style.css`.

## Database

- Postgres, accessed through **kysely** (`src/commons/db.ts` exports `Database`, `Db`, `createDb`).
  Do not add `postgres`/`postgres.js`; `pg` is only there as the kysely driver.
- Connection string comes from `DB_CONNECTION_STRING`.
- Schema changes are **migrations only** — never edit an existing migration, add a new one.
  - Files: `src/app/migrations/000NN_kebab-case-name.ts`, exporting `up(db: Kysely<any>)` and
    `down(db: Kysely<any>)`. Always type the parameter as `Kysely<any>`, never as the app's
    `Database` type — migrations must stay frozen in time and must not import app code.
  - `src/app/prepare-database.ts` runs them with kysely's `Migrator` + `FileMigrationProvider`
    (imported from `kysely/migration`) and throws on failure. It is called from `src/app/index.ts`
    and from the integration test setup.
  - Bookkeeping lives in the `kysely_migration` table.
- Local dev postgres runs via the root `docker-compose.yaml` (`pnpm start` starts it, `pnpm stop`
  stops it). Its data lives in `~/.monnaie-app/.db-data`; delete that folder to reset.

## Security

- **Never** use `eval`/`Function` for user input. `calculate()` accepts only `<number>` or
  `<number> <op> <number>` with `op` in `+ - * /`, validated by a single regex, and rejects
  non-finite results. Keep it that way.

## Tests

Three levels, each with its own script:

- `pnpm test:node` — `node:test` unit tests in `test/unit/**` (pure logic, e.g. `calculate`).
- `pnpm test:playwright` — integration tests in `test/integration`, running the app **in-process**
  (`makeApp` + `app.listen({port: 0})`) against a real postgres started by
  `@giltayar/docker-compose-testkit` from `test/integration/docker-compose.yaml`.
  `test/integration/common/setup.ts` gives each test *file* its own database (name = sha256 of
  `import.meta.url`), drops and recreates it in `beforeAll`, runs the migrations, and truncates
  tables in `beforeEach`.
- `pnpm test:e2e` — `test/e2e`, running the **published docker image** plus postgres via
  `test/e2e/docker-compose.yaml`. Requires `pnpm build` first (the image is built by
  `postbuild:docker` and tagged with the `package.json` version, passed to compose as
  `MONNAIE_APP_VERSION`). Keep this to a single happy-path test.

Gotchas:

- `docker compose port` reports `0.0.0.0:<port>`; Chromium refuses to navigate there, so the e2e
  setup rewrites it to `127.0.0.1`.
- The container must bind `HOST=0.0.0.0` (the app defaults to `localhost`), which the compose file sets.
- Locators belong in `test/page-model/**`, shared by integration and e2e tests. Each file exports a
  `create<Something>PageModel(page)` returning a nested object of functions whose leaves are
  `{locator}`; tests never call `page.getBy*` directly.
- The playwright configs use the `iPhone 15` device profile, since the app is mobile-first.
- `pretest` runs `build:htmx` so `dist/htmx.min.js` exists; the full `pnpm build` is only needed for
  the docker image (and therefore for `test:e2e`).
- Formatting failures from `eslint --max-warnings=0` are fixed with `npx eslint --fix .`.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440`, so `pnpm install` refuses dependency
  versions published in the last day. Pick an older version instead of approving the prompt.

## Docker

`Dockerfile` runs the app **from `src/` via Node's native TypeScript support** (`CMD ["node",
"./src/app/index.ts"]`), and only `dist` holds copied client assets (htmx). So anything needed at
runtime — including the migration files — must live under `src/` and must not rely on a build step.

- `pnpm build` first runs `build:*` (which copies `htmx.min.js` into `dist`) and then
  `postbuild:docker`, which builds `giltayar/monnaie-app:$npm_package_version` for `linux/amd64`,
  passing `~/.npmrc` as a build secret.
- `pnpm publish` triggers `postpublish`, which pushes that same tag to Docker Hub. The image tag and
  the npm version are therefore always the same string.
- `.dockerignore` is deny-by-default (`*`) with explicit `!package.json`, `!pnpm-lock.yaml`,
  `!pnpm-workspace.yaml`, `!src/`, `!dist/`. New runtime files must be added there too.
