# carmbo packages instructions

These rules apply to every package under `packages/carmbo`, in addition to the repository-wide
[AGENTS.md](../../AGENTS.md) and each package's own `AGENTS.md`.

## Optionality

⚠️ **No optional (`?`) properties or parameters, and no default parameter values**, with the
exceptions below. A value that may be absent is declared `T | undefined` and is still passed —
`{error: undefined}`, `addMember(..., DEFAULT_MEMBER_ROLES, undefined)` — so that every call site
says what it means, and adding a parameter or field breaks the call sites that have not thought
about it. When callers usually want the same value, export a named constant (for example,
`DEFAULT_MEMBER_ROLES`) and pass it explicitly instead of hiding it in a default.

The exceptions, which are utility-shaped enough that spelling out `undefined` at many call sites
would cost more than it says:

- `ControllerResult` (from `@giltayar/carmbo-commons`) — `status`, `headers`, and similar fields
  stay optional, since most controllers return nothing but HTML.
- **Props of html components** (for example, `MainLayout`'s `banner`), since they are written as
  attributes in a template, where an omitted attribute already reads as "none".
- Types owned by third-party libraries and published APIs of other packages, which are used as
  they are.

When changing existing code that does not follow this rule, fix the code you touch rather than
spreading the old pattern; do not rewrite unrelated code just for this rule.

## Architecture

Each domain is layered, and a layer may only import from the ones below it:

1. `route.ts` — **HTTP only**: zod schemas for the request, then delegate to a controller.
2. `controller.ts` — the only layer that knows both the model and the views. Returns a
   `ControllerResult`.
3. `model.ts` — logic and data access. No HTML, no fastify, and **no display text**: report
   failures as error _codes_ (for example, `MemberError('duplicate')`) and let the
   controller/view translate them.
4. `view/` — server-side rendering only.

Services that talk to the outside world (email providers, auth, third-party APIs) are ports: the
**types** live apart from the SDK-backed **implementation**, and only the composition root (the
host app's startup code) constructs the implementation. Every other layer, and every test, can
then be given a fake.

## Security

- ⚠️ Routes are **private by construction**: everything is mounted inside the host's
  authentication boundary, and a route is public only if it is deliberately registered outside it
  (health checks, static assets, signed provider webhooks). A public route must authenticate the
  request itself (for example, by verifying a webhook signature over the raw body).
- Nothing reaches SQL on trust: validate input with zod in the model before querying.
- Redirect to **fixed** paths only, never to a URL taken from the request (an open redirect).
- Responses must not reveal whether an account or email exists (identical answers for both
  cases), so a page cannot be used for enumeration.

## HTMX

- Server responses are HTML fragments. Client-side side effects (clearing an input, closing a
  dialog) are driven by an `HX-Trigger` response header plus `hx-on:<event>` on the element, not
  by returning replacement inputs, so the browser keeps transient UI state such as focus.
- Unauthenticated HTMX requests get `401` + `HX-Redirect`, not a `303`: HTMX follows a redirect
  inside its own request and would swap a whole login page into a fragment.

## Localization and bidirectional UI

- English and Hebrew are supported, and the UI is bidirectional. Use logical CSS properties
  (`margin-inline-start`, `padding-inline`, `text-align: start`) or Bootstrap's `start`/`end`
  utilities — never `left`/`right`.
- ⚠️ **Never call `i18next.changeLanguage()`** at runtime: it is process-global.
- Every locale file has exactly the same keys as its English counterpart, which is what the
  translation-key types are generated from.

## Database

- Schema changes are **migrations only**, and only in `carmbo-commons`. Never edit an existing
  migration; add a new one.
- Postgres returns `numeric` and `bigint` as strings. Convert them in one place at the model
  boundary, not throughout the code.
- Do not do timezone-dependent date arithmetic in SQL (`date_trunc`, `AT TIME ZONE`, `interval`):
  Postgres does not know the user's timezone. Compute half-open `[from, to)` ranges in TypeScript
  and let SQL only compare.

## Configuration

- Local secrets live in a git-ignored `.env.local` in the package root, loaded with Node's own
  `process.loadEnvFile` (no `dotenv`), resolved relative to `import.meta.url`, skipped when the
  file is missing, and never overriding a real environment variable. Commit a `.env.example`
  with placeholders.

## Tests

- Type-check with `pnpm test:typescript`; never invoke `tsc` (or `tsc6`) directly, so the compiler
  version and flags always come from the package's own script.
- Integration tests run the app **in-process** (`listen({port: 0})`) against a real Postgres started
  by `@giltayar/docker-compose-testkit`, with a database per test file. Fake external services.
- Keep E2E tests to a single happy path through the UI.
- Locators belong in page models: each exports `create<Something>PageModel(page)` returning a nested
  object of functions whose leaves are `{locator}`. Tests do not call `page.getBy*` directly.
- Assert through the UI whenever the state is visible there; query the database only for fixtures
  and for invariants the UI cannot show.
- Tests run in English (pin `locale: 'en-US'` in the Playwright config), so page models hardcode
  English strings. Only tests that deliberately check another language use other strings.
- Gotchas:
  - `docker compose port` can report `0.0.0.0:<port>`, which Chromium refuses to navigate to;
    rewrite it to `127.0.0.1`.
  - The first integration run on a clean machine can lose a container-creation race between
    Playwright workers (`container name ... is already in use`); re-run.
  - Formatting failures from `eslint --max-warnings=0` are fixed with `pnpm exec eslint --fix .`.
  - When `minimumReleaseAge` rejects a just-published dependency, pick an older version instead of
    approving the prompt (except `@giltayar/*`, which is excluded).
