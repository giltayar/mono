# monnaie-app — agent instructions

These are package-specific instructions. The monorepo-wide rules (ESM, prettier, package
independence, etc.) live in the root `AGENTS.md` and also apply here.

## TypeScript 6 and 7 side by side

The package is type-checked by **TypeScript 7** (the native compiler) but linted by
**typescript-eslint**, which still needs TypeScript 6. Both are installed, under aliases:

- `"@typescript/native": "npm:typescript@^7.0.2"` — the real TS 7, and the only thing that provides
  the **`tsc`** binary. `pnpm test:typescript` runs it.
- `"typescript": "npm:@typescript/typescript6@^6.0.2"` — TS 6 under the name every tool resolves by
  `require('typescript')`, which is how typescript-eslint gets a compiler it understands. Its binary
  is called **`tsc6`**, so it never collides with the one above.

⚠️ Do not "tidy" either alias away, and do not add a plain `typescript` dependency — the names are
swapped on purpose. There is no `tsgo` any more; `@typescript/native-preview` has been removed.
`minimumReleaseAge` in `pnpm-workspace.yaml` excludes `@typescript/*` so these can be installed.

## Optionality

⚠️ **No optional (`?`) properties or parameters in this package**, with the two exceptions below. A
value that may be absent is declared `T | undefined` and is still passed — `{error: undefined}`,
`{language: undefined}` — so that every call site says what it means and adding a field to a type
breaks the call sites that have not thought about it. Defaults belong in library code, not here.

The exceptions, both of which are utility-shaped enough that spelling out `undefined` at dozens of
call sites would cost more than it says:

- `ControllerResult` — `statusCode` and `headers` stay optional, since most controllers return
  nothing but HTML.
- **Props of html components** (`MainLayout`'s `styleSheet` and `script`), since they are written as
  attributes in a template, where an omitted attribute already reads as "none".

## Architecture

Layers, strictly in this order — a layer may only import from the ones below it:

1. `src/domain/<domain>/route.ts` — **HTTP only**: zod schemas for the request, then delegate.
   Registered as a fastify plugin, receives `{db}` as options. Ends every handler with
   `replyWithControllerResult(reply, await someController(db, ...))`.
2. `src/domain/<domain>/controller.ts` — the only layer that knows both the model and the views.
   Every controller returns `Promise<ControllerResult>` (`src/commons/controller.ts`):
   `{html, statusCode?, headers?}`, where `headers` carries HTMX headers such as `HX-Trigger`.
3. `src/domain/<domain>/model.ts` — pure logic + data access (kysely queries). No HTML, no fastify,
   and **no display text**: return error _codes_ (`{error: 'invalid'}`) and let the view translate
   them.
4. `src/domain/<domain>/view/view.ts` — htm + vhtml rendering, wrapped in `src/layout/main-view.ts`.
   Domain CSS lives in `src/domain/<domain>/view/style/style.css` and is served from source.

`src/services/` sits beside `src/commons/` and holds the app's ports to the outside world. Each
service is two files: `<service>.ts` with the **types only**, and `<service>-impl.ts` with the code
and the SDK dependency. Nothing but `src/app/index.ts` imports an `-impl`, so every other layer —
and every test — can be given a fake instead.

`src/app/monnaie-app.ts` exports `async makeApp({connectionString, language, auth, firebaseConfig})`
returning `{app, db}`; it is the only place that wires fastify, the zod type provider, static
serving, and the routes, and it is also what initializes i18next and runs the migrations (which is
why it is async). `src/app/index.ts` only parses env vars with zod, constructs the service
implementations, and listens. Every environment variable it reads is prefixed `MONNAIE_`.

`src/app/env-file.ts` loads the git-ignored `.env.local` in the package root, using node's own
`process.loadEnvFile` — no `dotenv`. It is resolved relative to `import.meta.url` (so the working
directory does not matter), it is a no-op when the file is missing (which is the case in the docker
image, since `.dockerignore` is deny-by-default), and node lets a real environment variable win over
the file. It is called by `src/app/index.ts` and by `test/e2e/playwright.config.ts`, which is how
the e2e Firebase credentials get in.

## HTMX conventions

- Server responses are HTML fragments; out-of-band swaps (`hx-swap-oob`) update the summary when an
  expense is deleted.
- ⚠️ A form that fails validation is answered with `400` **and** with the form re-rendered, and htmx
  refuses to swap a `4xx` by default. `MainLayout` therefore sets `htmx.config.responseHandling`
  through a `<meta name="htmx-config">`, adding a `400 → swap` entry _before_ the `[45]..` one. The
  rest of that list is htmx's own default, repeated because the setting replaces it wholesale.
- Client-side side effects (like clearing the input) are driven by an `HX-Trigger` response header
  plus `hx-on:<event>` on the element — _not_ by returning a new `<input>`. This keeps the response
  about data and lets the browser own transient UI state (focus, selection).

## Views and CSS

- HTML is rendered server-side with **htm + vhtml**, through `html` from
  `src/commons/html-templates.ts`. vhtml marks the strings it returns as sanitized, so nested
  components compose without double-escaping while interpolated _values_ are still escaped.
- `html` returns `string | string[]` (an array when a template has several roots), so view functions
  that declare `: string` end their template with `` ` as string``.
- htm's types ship as CJS (`dist/htm.d.ts`) while ESM resolves to `dist/htm.mjs`, so TypeScript
  types the default import as the module namespace and `htm.bind` appears to be missing. That is why
  `html-templates.ts` carries a `//@ts-expect-error`; `esModuleInterop` does **not** fix it.
- `MainLayout({title, styleSheet, script, children})` — `styleSheet` is a path **relative to `src`**
  (e.g. `domain/expenses/view/style/style.css`) and, when given, adds a second
  `<link rel="stylesheet">`. Domain views never build asset hrefs themselves.
- Assets are served versioned and immutable: `/dist/<version>/...` for built client assets and
  `/src/<version>/...` for source `.css`/`.js` only. `version` comes from `package.json`, so bumping
  the version busts the cache.
- CSS is hand-written and **mobile-first** — no bootstrap or other CSS framework, and no BEM class
  naming. Use scoped selectors (`#expense-form input`) with **native CSS nesting**. Shared
  tokens (`--spacing`, `--radius`, `--border-color`) live in `src/layout/style/style.css`; anything
  domain-specific goes in that domain's `view/style/style.css`.
- The app is bidirectional, so use **logical properties** only — `padding-inline`, `margin-block`,
  `border-inline-start`, `text-align: start`, `inset-inline` — never `left`/`right`/`margin-top`.
  Flexbox and grid already follow `dir`, so they need no special handling.

## Localization

English and Hebrew, with **i18next** + **i18next-fs-backend**, and the language chosen **per
request**.

- `src/commons/i18n.ts` is the whole of it: `initializeI18n`, `resolveLanguage`, `negotiateLanguage`,
  `currentLanguage`, `currentDirection`, `translator`, `languageCookie`, and the `Language` type.
- Translations are JSON, one file per namespace × language, colocated with what they translate:
  `src/layout/locale/<lng>.json` for the `layout` namespace and
  `src/domain/<domain>/locale/<lng>.json` for every other one — namespace name == domain folder name.
  `backend.loadPath` resolves them relative to `import.meta.url`, so the app can be started from any
  working directory.
- Views call `const t = translator('<namespace>')` **inside** the render function and never at module
  scope: `t` is bound to one language, and the language changes per request.
- The language of the request lives in `@fastify/request-context` (AsyncLocalStorage), put there once
  per request by `defaultStoreValues` in `makeApp`. Nothing threads a `language` argument through the
  layers. Outside a request (unit tests, scripts) `currentLanguage()` falls back to the default.
- ⚠️ **Never call `i18next.changeLanguage()`** — it is process-global and would race between
  concurrent requests. `getFixedT(language, ns)` is the only correct way to translate here.
- ⚠️ `@fastify/cookie` must be registered **before** `@fastify/request-context`: both use `onRequest`
  hooks, fastify runs them in registration order, and `resolveLanguage` reads `request.cookies`.
- Language resolution order: the **saved setting of the logged-in user** → the `lang` cookie → the
  `Accept-Language` header → the `LANGUAGE` environment variable (default `en`). The first three
  steps happen in two places: `resolveLanguage` (a root hook) does the last three, and `resolveUser`
  overwrites `language` in the request context afterwards when the user has one saved — which is why
  the setting survives moving to a browser that has never seen the cookie. `POST /language`
  (`src/domain/language/`) sets the cookie _and_, when there is a user, saves it with
  `updateUserSettings`, then redirects to the **fixed** path `/` — never to a URL taken from the
  request, which would be an open redirect. The switcher (`src/layout/language-switcher.ts`) is a
  plain form and deliberately not HTMX, because `lang`, `dir` and every string on the page change.
- `<html lang dir>` comes from `currentLanguage()`/`currentDirection()` in `MainLayout`;
  `currentDirection()` is just `i18next.dir()`.
- `interpolation.escapeValue` is `false` because vhtml already escapes interpolated values — turning
  it on would double-escape `&`, `<` and `'`.
- Translation keys are type-checked: `src/@types/i18next.d.ts` augments `CustomTypeOptions` from the
  **English** JSONs, so `t('form.amout')` is a compilation error. Only English is checked that
  way, which is why `test/unit/commons/locale-completeness.test.ts` asserts that the other languages
  have exactly the same keys.
- Adding a namespace means touching three places: create `src/domain/<x>/locale/{en,he}.json`, add
  `'<x>'` to `NAMESPACES` in `src/commons/i18n.ts`, and add it to `resources` in
  `src/@types/i18next.d.ts` (and to the list in the locale-completeness test).

## Expenses

The whole app, apart from logging in and switching languages, is `src/domain/expenses/`: a summary
page (`GET /`) with the totals of the current and previous day, week, month and year plus this
month's expenses, and a form (`GET /expenses/new`, `GET /expenses/:id/edit`) that adds, edits and
deletes them.

- ⚠️ **All date arithmetic happens in `src/domain/expenses/periods.ts`, with `Temporal`, and never in
  SQL.** `periodRanges(now, timeZone)` returns a half-open `{from, to}` for each of the eight
  periods, and the model does nothing but `>= from` and `< to`. No `date_trunc`, no `interval`, no
  `AT TIME ZONE` — postgres does not know which timezone the user lives in, and a `date_trunc` day
  is not the same as a day that is 23 or 25 hours long.
- `periods.ts` is pure and is the only file in the app that mentions `Temporal`. A week starts on
  **Sunday** (`day.subtract({days: zoned.dayOfWeek % 7})`, since `dayOfWeek` is 1..7 with Monday as
  1).
- The timezone the periods are calculated in is `MONNAIE_TIMEZONE` (an IANA name, checked against
  `Intl.supportedValuesOf('timeZone')`, default `UTC`), threaded from `makeApp` into the routes as
  `timeZone` — it is _not_ per-user yet.
- The summary and the list are answered from a **single** `periodRanges(new Date(), ...)`, so the
  totals and the list can never disagree about where the month starts. The eight totals are one
  query, with eight `sum(amount) filter (where ...)` expressions.
- Categories are the hardcoded `EXPENSE_CATEGORIES` in `src/domain/expenses/categories.ts`, and the
  `expense` row refers to one by **number**, not by name — the table is already shaped for
  categories that a user will eventually edit. The names are English-only and deliberately not in
  the locale files yet, since they will become data.
- `amount` is `numeric(12, 2)`, and kysely types it as `ColumnType<string, number, number>`: postgres
  hands back a string, which the model turns into a number in one place (`toExpense`/`toAmount`).

### The expense filters

A filter form under the `Monnaie` heading narrows the eight totals, the list and the pie. Its
`Filter` button reveals category checkboxes; none ticked means no category filter. Beside that
button, three always-visible rectangular checkbox pills select day-to-day, special and recurring
expenses. Double-clicking or long-pressing one type selects it exclusively. At least one type stays
selected, and an absent type query defaults to day-to-day plus special (not recurring).

- The selection lives in the URL as repeated **`?category=<id>`** params — `/?category=1&category=5`,
  `/expenses/graphs?category=1` — so it is bookmarkable and works with back/forward. The ids are the
  `EXPENSE_CATEGORIES` ids and never the names: an id is permanent, whereas a name will change the
  moment categories become user-editable rows, and the Hebrew names would percent-encode into
  unreadable URLs. `categoryFilterQuery` in `view/view.ts` is the only place that builds the query,
  and `parseCategoryFilter` in `model.ts` the only place that reads it — it drops ids that are not
  categories rather than answering `400`, since a stale bookmark should still render.
- The type selection lives in repeated **`?expenseType=<type>`** params. The default selection is
  omitted from the URL; `parseExpenseTypeFilter` restores it when no type params are present.
- ⚠️ The form swaps **`#expense-content`** (summary + add link + monthly section) and is itself
  rendered _outside_ it, so nothing ever re-renders the form. Which pills are ticked and whether the
  category panel is open are therefore the browser's business, exactly as with the HTMX conventions
  above. Do not move the form inside `#expense-content` "for consistency" — a swap would reset it
  mid-interaction.
- It is a plain `<form method="get">` with `hx-trigger="change"`, so htmx serializes the ticked boxes
  into the query string itself; there is no per-pill link and nothing to keep in sync.
- ⚠️ Because the form is never re-swapped, its `hx-get` is frozen at the tab the page _loaded_ on,
  which sent a pill ticked on the Graphs tab back to the expenses list. The path therefore comes
  from the address bar at request time —
  `hx-on:htmx:config-request="event.detail.path = location.pathname"` — which the tabs keep current
  through `hx-push-url`. The rendered `action`/`hx-get` still matter without htmx, where every tab
  click is a full navigation and re-renders the form anyway.
- ⚠️ Anything that re-renders the totals or the list has to be told the filter, or it will silently
  answer with unfiltered data: the tab links carry it in their `href`, and so does each row's
  `hx-delete`, whose response contains the out-of-band summary.
- ⚠️ `min(created_at)` in `fetchPeriodTotals` is deliberately **not** filtered while the eight
  `sum`s are — which is why the filter is applied with `filterWhere` on each aggregate rather than
  with one `where` over the query. The daily averages are capped by when this user started tracking
  at all, and ticking a category must not appear to move that date.

## Database

- Postgres, accessed through **kysely** (`src/commons/db.ts` exports `Database`, `Db`, `createDb`).
  Do not add `postgres`/`postgres.js`; `pg` is only there as the kysely driver.
- Connection string comes from `MONNAIE_DB_CONNECTION_STRING`.
- The `app_user` table holds **settings, not identities** — Firebase owns the identities, and
  `user_id` is the Firebase uid, with no foreign key to enforce it. It is called `app_user` because
  `user` is a reserved SQL keyword. `settings` is a single `jsonb` column, so a new setting is not a
  migration; it is a field in `UserSettings` in `src/commons/db.ts` and in `UserSettingsSchema` in
  `src/domain/user/model.ts`.
- `src/domain/user/` is a domain of **model only** — no route, controller or view — exporting
  `ensureUser`, `userSettings`, `updateUserSettings` and `parseUserSettings`. `ensureUser` is an
  upsert that does nothing on conflict, and is called on every login, so a user made by hand in the
  Firebase console gets their row on their first visit.
- Reading settings goes through `parseUserSettings`, whose schema ends in `.catch({})`: the column is
  `jsonb`, so a row written by an older version of the app must degrade to "nothing chosen yet"
  rather than fail the request that happened to load it.
- Schema changes are **migrations only** — never edit an existing migration, add a new one.
  - Files: `src/app/migrations/000NN_kebab-case-name.ts`, exporting `up(db: Kysely<any>)` and
    `down(db: Kysely<any>)`. Always type the parameter as `Kysely<any>`, never as the app's
    `Database` type — migrations must stay frozen in time and must not import app code.
  - `src/app/prepare-database.ts` runs them with kysely's `Migrator` + `FileMigrationProvider`
    (imported from `kysely/migration`) and throws on failure. It is called by `makeApp`, so both the
    app and the integration tests migrate on startup.
  - Bookkeeping lives in the `kysely_migration` table.
- Local dev postgres runs via the root `docker-compose.yaml` (`pnpm start` starts it, `pnpm stop`
  stops it). Its data lives in `~/.monnaie-app/.db-data`; delete that folder to reset.

## Authentication

Firebase Authentication, as a **server-minted session cookie**. There is no user table for
_identities_ — Firebase owns those — only an `app_user` table for settings (see below).

- `src/services/firebase-auth.ts` declares `FirebaseAuth` — `signInWithPassword`, `createUser`,
  `createSession`, `verifySession`, `sendVerificationEmail`, `sendPasswordResetEmail` — and
  **nothing else**: it is types only, so that `firebase-admin` is imported by exactly one file,
  `src/services/firebase-auth-impl.ts`. That is what lets the integration tests hand `makeApp` a fake
  (`test/integration/services/fake-firebase-auth.ts`, which mirrors the `src/services` layout) and
  never touch Firebase or the network. `makeApp` therefore takes `{auth, firebaseConfig}` alongside
  `{connectionString, language}`.
- Email/password sign-in happens **server-side**, through the Identity Toolkit REST API, so the
  login form is a plain form POST. Google sign-in is the one thing that must happen in the browser:
  `src/domain/login/view/client/google-sign-in.js` loads the Firebase Web SDK from Google's CDN
  (there is no bundler — the file is served from source by the existing `/src/<version>/` route),
  and POSTs the resulting ID token to `/login/session`.
- The ID token is never kept in the browser. The server verifies it, checks that the sign-in is less
  than five minutes old, and answers with an `HttpOnly` session cookie. `SameSite=Lax` on that
  cookie is the CSRF defence for every form in the app, and `Secure` is added when
  `NODE_ENV=production`.
- ⚠️ Routes are **private by construction**. `makeApp` nests two anonymous plugins: the outer one
  adds `resolveUser` (which puts the user in `@fastify/request-context`), the inner one adds
  `requireAuthentication`. A new route is only reachable without a session if it is deliberately
  registered _outside_ those plugins, as `/health` and the static routes are.
- ⚠️ Those hooks are added inside plugins rather than on the root instance on purpose: an
  encapsulated `onRequest` hook is guaranteed to run **after** the root hooks of `@fastify/cookie`
  and `@fastify/request-context`, whereas `app.addHook` at the root would run _before_ them.
- Unauthenticated HTMX requests get `401` + `HX-Redirect`, not a `303`: HTMX follows a redirect
  inside its own request, which would swap a whole login page into a fragment.
- `currentUser()` may be `undefined`; `authenticatedUser()` throws. Views (the user menu) use the
  first, routes behind `requireAuthentication` use the second and pass `userId` down explicitly —
  authorization is never left to ambient state, so every `expense` query is scoped by `user_id`.
- Login errors are codes (`invalid-credentials`, `too-many-attempts`, `unavailable`) translated by
  the view, like every other model error. A wrong password and an unknown email deliberately produce
  the _same_ message, so the login page cannot be used to discover which accounts exist.

### Registration

Registration lives in the **login domain** (`GET`/`POST /register`), not in one of its own: it is the
same form, the same styles and the same error vocabulary as logging in.

- ⚠️ **No email is composed by this app.** `createUser` makes the account through `firebase-admin`,
  and the confirmation mail is asked for with the Identity Toolkit `accounts:sendOobCode` endpoint,
  which makes Firebase send its own templated message. Do not add a mailer, an SMTP config or a
  `/verify` route — the link in the mail is handled by Firebase's own
  `<authDomain>/__/auth/action` page.
- ⚠️ `POST /register` answers **identically** whether or not the email already has an account:
  the same "check your email" page. An address that already exists is sent a _password reset_
  instead of a verification, and no row is created. Anything that makes the two paths
  distinguishable — a different message, a different status code, a redirect — turns the page into an
  account-enumeration oracle.
- `createSession` and `verifySession` refuse a user whose email is not verified, which is what makes
  the confirmation mandatory rather than decorative. Logging in as an unverified user re-sends the
  link using the ID token that `signInWithPassword` just returned, which is why there is no "resend"
  button and nothing is stored to support one.
- `validateRegistration` is pure and checked before Firebase is touched at all; `PASSWORD_MIN_LENGTH`
  is exported so the view can put it in `minlength` and in the hint. The client-side `minlength` is
  UX only — the server repeats every check.
- ⚠️ Users created in the Firebase console start with `emailVerified === false` and therefore cannot
  log in. Flip them to verified in the console.

### Forgotten passwords

`GET`/`POST /forgot-password`, also in the login domain, and also composing no mail of its own:
`sendPasswordResetEmail` asks Identity Toolkit for a `PASSWORD_RESET` oob code and Firebase sends
its own templated message, whose link is handled by Firebase's action page. There is no `/reset`
route in this app, and no token of any kind is stored.

- ⚠️ Like registration, the answer is **identical** for an address that has an account and one that
  does not: the same "check your email" page. Firebase rejects an unknown address with the same code
  it uses for a wrong password (`invalid-credentials`), and `requestPasswordReset` swallows exactly
  that one, reporting only failures that say nothing about the address (`too-many-attempts`,
  `unavailable`).
- The email is validated with the same regex registration uses before Firebase is touched, so a
  typo is answered on the page rather than by a pointless round-trip.

## Security

- Amounts and category ids are validated by `validateExpense` before they reach SQL — an amount has
  to match `/^\d+(?:\.\d{1,2})?$/` and be within range, and a category id has to be an integer that
  `isKnownCategoryId` recognizes. Nothing is passed on to kysely on trust.
- Every `expense` query is scoped by `user_id`, so knowing an id is not enough to read, edit or
  delete somebody else's expense; `test/integration/login/login.test.ts` guards that.
- Never trust an ID token that Firebase has not verified, and never put one (or the session cookie)
  anywhere a script can read it.

## Tests

Type-check with `pnpm test:typescript` — never invoke `tsc` (or `tsc6`) directly, so that the
compiler version and the project flags always come from the package's own script.

Three levels, each with its own script:

- `pnpm test:node` — `node:test` unit tests in `test/unit/**` (pure logic, e.g. `validateExpense`
  and `periodRanges`).
- `pnpm test:playwright` — integration tests in `test/integration`, running the app **in-process**
  (`makeApp` + `app.listen({port: 0})`) against a real postgres started by
  `@giltayar/docker-compose-testkit` from `test/integration/docker-compose.yaml`.
  `test/integration/common/setup.ts` gives each test _file_ its own database (name = sha256 of
  `import.meta.url`), drops and recreates it in `beforeAll` (`makeApp` then runs the migrations), and
  truncates tables in `beforeEach`. It also returns a `logIn(page, user)` that installs a session
  cookie directly from the fake — signing in _through the form_ is `login/login.test.ts`'s job, and
  every other test just needs to already be logged in (which also keeps `language.test.ts` working
  in Hebrew). ⚠️ It creates the `app_user` row with **empty** settings on purpose: seeding a language
  there would pin every test to it and hide the cookie and `Accept-Language` steps.
- `pnpm test:e2e` — `test/e2e`, running the **published docker image** plus postgres via
  `test/e2e/docker-compose.yaml`. Requires `pnpm build` first (the image is built by
  `postbuild:docker` and tagged with the `package.json` version, passed to compose as
  `MONNAIE_APP_VERSION`). Keep this to a single happy-path test. The container talks to the real
  Firebase, so it cannot be given the fake: the whole file skips itself unless
  `MONNAIE_FIREBASE_API_KEY`, `MONNAIE_FIREBASE_SERVICE_ACCOUNT`, `MONNAIE_FIREBASE_TEST_EMAIL` and
  `MONNAIE_FIREBASE_TEST_PASSWORD` are set. ⚠️ Its compose file overrides the image's
  `NODE_ENV=production` with `test`, because production adds `Secure` to the session cookie — see
  the gotcha below.

Gotchas:

- ⚠️ The tests run on **WebKit** (that is what `devices['iPhone 15']` selects), and WebKit drops a
  `Secure` cookie served over plain http — including on `127.0.0.1`, which Chromium alone treats as
  trustworthy. So anything served to a test over http must not set `Secure`. The symptom is
  maddening rather than obvious: the login succeeds, the `303` really does carry `Set-Cookie`, and
  the very next request arrives with no cookie and is bounced back to the login page.
- `docker compose port` reports `0.0.0.0:<port>`; Chromium refuses to navigate there, so the e2e
  setup rewrites it to `127.0.0.1`.
- The integration `docker compose up` can lose a race when several playwright workers start at once
  (`container name ... is already in use`). It is a flake of the first run on a clean machine only,
  since the containers are deliberately left running afterwards; re-run.
- The container must bind `MONNAIE_HOST=0.0.0.0` (the app defaults to `localhost`), which the compose file sets.
- Locators belong in `test/page-model/**`, shared by integration and e2e tests. Each file exports a
  `create<Something>PageModel(page)` returning a nested object of functions whose leaves are
  `{locator}`; tests never call `page.getBy*` directly.
- Every integration and e2e test runs in **English**, so the page models hardcode English strings.
  The one exception is `test/integration/language/language.test.ts`, which is the only test file
  that switches languages and therefore the only one allowed to use locators directly.
- The playwright configs pin `locale: 'en-US'` so the locale of the machine running the tests cannot
  leak into `Accept-Language` and flip the app to Hebrew. `language.test.ts` asks for Hebrew with
  `test.use({locale: 'he-IL'})`.
- The playwright configs use the `iPhone 15` device profile, since the app is mobile-first.
- `pretest` runs `build:htmx` so `dist/htmx.min.js` exists; the full `pnpm build` is only needed for
  the docker image (and therefore for `test:e2e`).
- Formatting failures from `eslint --max-warnings=0` are fixed with `npx eslint --fix .`.
- `pnpm-workspace.yaml` sets `minimumReleaseAge: 1440`, so `pnpm install` refuses dependency
  versions published in the last day. Pick an older version instead of approving the prompt.

## Docker

`Dockerfile` runs the app **from `src/` via Node's native TypeScript support** (`CMD ["node",
"./src/app/index.ts"]`), and only `dist` holds copied client assets (htmx). So anything needed at
runtime — including the migration files and the locale JSONs — must live under `src/` and must not
rely on a build step.

- `pnpm build` first runs `build:*` (which copies `htmx.min.js` into `dist`) and then
  `postbuild:docker`, which builds `giltayar/monnaie-app:$npm_package_version` for `linux/amd64`,
  passing `~/.npmrc` as a build secret.
- `pnpm publish` triggers `postpublish`, which pushes that same tag to Docker Hub. The image tag and
  the npm version are therefore always the same string.
- `.dockerignore` is deny-by-default (`*`) with explicit `!package.json`, `!pnpm-lock.yaml`,
  `!pnpm-workspace.yaml`, `!src/`, `!dist/`. New runtime files must be added there too.
