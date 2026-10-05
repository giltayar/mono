---
name: carmbo-app-splitting
description: Extract a domain or page subsystem from packages/carmbo/carmbo-app into an independent packages/carmbo/carmbo-pages-* package. Use when splitting another carmbo-app src/domain folder into a publishable package, deciding its exports, moving locales/assets/tests, or updating carmbo-app to consume a newly published Carmbo pages package.
---

# Splitting a package from `carmbo-app`

Use this workflow to extract a domain from `packages/carmbo/carmbo-app/src/domain/<domain>` into an
independent package such as `packages/carmbo/carmbo-pages-<domain>`.

This repository does not use workspace linking or dependency hoisting. A new package and
`carmbo-app` are two independent consumers of published npm artifacts. Treat extraction and app
adoption as separate phases.

## Before changing code

Trace the complete boundary, not only the route imported by `carmbo-app.ts`.

Search for:

- All files under `src/domain/<domain>`.
- Imports of that domain from other app domains.
- Imports from app startup, request-context declarations, locale setup, and static asset setup.
- Unit, integration, and page-model tests for the domain.
- CSS, JavaScript, images, JSON locales, templates, SQL access, and test fixtures owned by it.
- Mutable module state and test-only reset functions.
- Dependencies imported by the domain that will need to move to the new manifest.

Useful searches:

```bash
find src/domain/<domain> -type f
rg "domain/<domain>|\\.\\./<domain>|\\.\\./\\.\\./<domain>" src test
rg "<important exported symbol>" src test
```

Compare the result with:

- `packages/carmbo/carmbo-pages-auth` for a small page package.
- `packages/carmbo/carmbo-pages-job` for routes plus a reusable application service, package-owned
  locales/assets, a top-level testkit, and moved browser coverage.

Ask about meaningful boundary choices instead of assuming them. In particular, determine whether
the package owns only the UI or the complete domain subsystem.

## Phase 1: create and validate the independent package

Do not modify `carmbo-app` during this phase unless the user explicitly asks to combine phases and
the package has already been published. The app cannot consume unpublished local package changes.

### 1. Scaffold from a current Carmbo package

Create `packages/carmbo/carmbo-pages-<domain>` with its own:

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `tsconfig.json` and `tsconfig.build.json`
- `eslint.config.mjs`
- `.prettierrc`, `.gitignore`, and `AGENTS.md`
- `src/`, `test/`, `start/`, and, when needed, top-level `testkit/`
- `README.md` with local-start instructions

Use the current TypeScript setup:

```json
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@^7.0.2",
    "typescript": "npm:@typescript/typescript6@^6.0.2"
  }
}
```

Build and type-check with `tsc`, not `tsgo`. Preserve the package conventions for strict ESM,
`.ts` local imports, `verbatimModuleSyntax`, `erasableSyntaxOnly`, and named exports.

The package should normally be restricted to GitHub Packages:

```json
{
  "publishConfig": {
    "access": "restricted",
    "registry": "https://npm.pkg.github.com/"
  }
}
```

### 2. Design explicit entry points

Do not expose internal files through wildcard exports. Group APIs by consumer purpose.

Typical entry points:

- `./routes`: Fastify plugins used by app composition.
- Narrow domain-specific entries such as `./jobs/executor` and `./jobs/handler`: reusable runtime
  functions and public types used by other app domains. Prefer mapping these entries directly to
  implementation modules instead of adding barrel files.
- `./testkit`: test-only controls and fakes, implemented in a top-level `testkit/` folder outside
  `src/`.
- `./package.json`: package metadata.

Example:

```json
{
  "exports": {
    "./routes": {
      "types": "./dist/src/routes.d.ts",
      "import": "./dist/src/routes.js"
    },
    "./jobs/executor": {
      "types": "./dist/src/job-executor.d.ts",
      "import": "./dist/src/job-executor.js"
    },
    "./jobs/handler": {
      "types": "./dist/src/job-handlers.d.ts",
      "import": "./dist/src/job-handlers.js"
    },
    "./testkit": {
      "types": "./dist/testkit/carmbo-pages-example-testkit.d.ts",
      "import": "./dist/testkit/carmbo-pages-example-testkit.js"
    },
    "./package.json": "./package.json"
  }
}
```

Include `src`, `testkit`, and `dist` in `files` when a testkit exists. Include both `src/**/*.ts`
and `testkit/**/*.ts` in the build config.

Export what consumers actually need:

- Route plugins.
- Initialization functions.
- Cross-domain operations.
- Types used in consumer signatures.

Keep these private:

- Controllers, models, views, and rendering helpers.
- Mutable registries and module globals.
- Database query result types used only internally.
- Test reset functions from production entry points.

Expose reset functions and fakes only through `./testkit`.

### 3. Make dependency direction explicit

The new package may depend on `@giltayar/carmbo-commons`, but it must not depend on `carmbo-app`.

Replace hidden app coupling with explicit plugin or initialization options:

```ts
export function routes(app: FastifyInstance, options: {sql: Sql}): void
```

If a route previously read a service from app-specific request context, prefer passing that service
through plugin options unless request-scoped access is genuinely required. This keeps the package
independently testable and prevents its types from depending on the app's module augmentation.

Classify manifest dependencies:

- `dependencies`: implementation dependencies used at runtime.
- `peerDependencies`: host framework instances/types that the app and package must share, such as
  Fastify, i18next, postgres, Zod, and Fastify's Zod provider.
- `devDependencies`: peer dependencies needed to build/test plus test tooling.

Use versions consistent with current Carmbo packages.

### 4. Move localization with the package

The package that renders translated UI owns its locale resources.

Recommended structure:

```text
src/
  @types/i18next.d.ts
  locale/en.json
  locale/he.json
  locale-resources.ts
```

The registration module imports both JSON files and registers the existing namespace:

```ts
import i18next from 'i18next'
import en from './locale/en.json' with {type: 'json'}
import he from './locale/he.json' with {type: 'json'}

export function registerExampleLocaleResources(): void {
  i18next.addResourceBundle('en', 'example', en, true, true)
  i18next.addResourceBundle('he', 'example', he, true, true)
}
```

Call this from the page route plugin so app consumers do not need a separate locale API. The host
must initialize base i18next before registering the plugin.

Keep the i18next `CustomTypeOptions` augmentation in the package:

```ts
import enExample from '../locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      example: typeof enExample
    }
  }
}
```

During app adoption, remove this namespace from `carmbo-app` filesystem locale discovery and remove
its app-owned resource typing. Test both English and Hebrew startup/rendering in the new package.

Do not repeatedly switch languages after a filesystem backend has discovered a dynamically
registered namespace; that can make it try to load the package namespace from the app's locale
root. For tests, initialize i18next in the desired language and then register package resources,
matching production startup order.

### 5. Make assets package-owned

Do not leave links pointing into `carmbo-app/src/domain/<domain>`.

Use one of these patterns:

- Add a Fastify asset plugin backed by package-owned files, following
  `@giltayar/carmbo-commons/layout/assets`.
- For a small stylesheet, serve a package-owned CSS string from the domain route plugin.

Keep URLs stable where practical and test the response content type and a representative asset
payload. A package is not independent if its HTML still relies on the app serving its source tree.

### 6. Add a package-local `pnpm start` workflow

Every extracted pages package must be runnable independently for interactive browser testing. Add:

- `start/start.ts`: a Fastify host for the package routes.
- `start/docker-compose.yaml`: package-local PostgreSQL with a non-production default host port.
- `start/dist/`: generated static assets, ignored by Git and ESLint.
- `pnpm start` and `pnpm stop` instructions in the package README.

Use lifecycle scripts that keep asset staging extensible:

```json
{
  "scripts": {
    "prestart": "rm -rf start/dist && mkdir -p start/dist && run-p 'prestart:*'",
    "prestart:bootstrap": "cp node_modules/bootstrap/dist/css/bootstrap.min.css node_modules/bootstrap/dist/css/bootstrap.rtl.min.css node_modules/bootstrap/dist/js/bootstrap.bundle.min.js start/dist/",
    "prestart:htmx": "cp node_modules/htmx.org/dist/htmx.min.js start/dist/",
    "start": "run-p --race 'start:*'",
    "start:app": "node --watch start/start.ts",
    "start:postgres": "docker compose --file start/docker-compose.yaml up",
    "stop": "docker compose --file start/docker-compose.yaml down"
  }
}
```

The top-level `prestart` owns recreating `start/dist`; individual `prestart:*` scripts only copy
one asset group into it. Add another `prestart:*` script when a package needs more generated or
third-party assets.

The start Fastify host should:

- Wait for PostgreSQL and run the shared migrations.
- Initialize i18next, the package version, and UI configuration.
- Register the same body parser, validators, serializers, and request context required in
  production.
- Register `@giltayar/carmbo-commons` layout assets.
- Serve `start/dist` through one `@fastify/static` registration at the versioned `/dist/` prefix;
  do not add one explicit route per asset.
- Create fake external integrations with safe example data and pass all route dependencies through
  explicit plugin options. Never require real credentials.
- Register the package routes at their production prefix and redirect `/` to the primary page.
- Log the stable local URL and close Fastify/PostgreSQL on termination signals.

Include `start/**/*.ts` in type-checking and ESLint, but normally exclude it from the production
TypeScript build and published `files`. Add `@fastify/static`, Bootstrap, HTMX, and fake-integration
testkits as development dependencies when the start host needs them.

Validate the workflow itself: run `pnpm start`, request the primary page and representative CSS/JS
assets, verify their content types, run `pnpm stop`, and confirm that no Compose service remains.

### 7. Move tests with behavior ownership

Copy and adapt all domain-focused tests into the new package before deleting anything from the app.
Do not replace ten behavior tests with one smoke test.

Preserve the original organization:

- `test/integration/<singular>.test.ts` for detail-page behavior.
- `test/integration/<plural>.test.ts` for list-page behavior.
- `test/integration/routes.test.ts` for package-specific route wiring, API authorization, assets,
  and localization.
- `test/integration/setup.ts` for shared Fastify/PostgreSQL lifecycle.
- `test/unit/` for service/executor/model behavior.
- Top-level `testkit/` for public test helpers; `test/` is never published.

The shared setup should:

- Start an isolated PostgreSQL service.
- Run migrations.
- Initialize i18next, version, and UI configuration.
- Create Fastify with the required compilers/plugins.
- Initialize domain runtime state.
- Register page and API routes under their real prefixes.
- Truncate domain tables and reset module state before each test.
- Close Fastify, SQL, and Docker resources.

If deterministic timestamps are used, assign distinct creation times where ordering is asserted.
SQL ordering by a tied timestamp is undefined.

Add a consumer test that imports only published subpaths and asserts the intended runtime export
keys. This catches accidental public exports and broken export-map targets.

### 8. Install and validate in the package directory

Run commands from the new package directory:

```bash
pnpm install
pnpm build
pnpm test
npm pack --dry-run
```

If `pnpm` is not directly available, use the repository's declared version through an available
package-manager launcher, but still run it with the new package as the working directory.

Validation must cover:

- Package-local `pnpm start`/`pnpm stop`, the primary page, and staged static assets.
- TypeScript.
- ESLint with zero warnings.
- Unit tests.
- Browser/integration tests.
- English and Hebrew rendering.
- Assets.
- Every copied app behavior scenario.
- Export-map consumption.
- Publish contents.

At the end of phase 1, `carmbo-app` and its existing tests remain unchanged.

## Publish boundary

Only the user publishes packages. Never run `pnpm publish` or ask whether to publish. After phase 1
passes, report that the package is ready and stop at the publish boundary. Resume only after the
user provides the exact published version.

Do not update `carmbo-app` to a version that has not been published; local source changes are not
visible across these independent packages.

## Phase 2: adopt the published package in `carmbo-app`

### 1. Add the published dependency

Add the exact compatible `@giltayar/carmbo-pages-<domain>` version to `carmbo-app/package.json`,
then run `pnpm install` in `carmbo-app`.

Remove dependencies from `carmbo-app` only when no remaining app code uses them.

### 2. Rewire every consumer

Update all imports found during discovery:

- `carmbo-app.ts` route registration.
- App initialization.
- Other domains that call the extracted service.
- Public types used across domains.
- Integration setup imports from `./testkit`.
- Request-context declarations/options if the package API removed that coupling.

Register page routes inside the same authentication scope as before. Keep API routes in their
original authentication/secret scope and preserve prefixes exactly.

### 3. Remove app-owned resources and source

After imports compile against the published package:

- Delete `src/domain/<domain>`.
- Remove the package namespace from app i18next filesystem discovery.
- Remove its app-owned i18next resource typing/import.
- Remove obsolete app static-asset assumptions.
- Remove unit tests now owned by the package.
- Remove duplicated behavior integration tests only after the package suite and app adoption pass.

Retain a small app-level integration smoke test when useful to prove:

- The published package is installed.
- Routes are mounted under the correct prefixes.
- Authentication boundaries are correct.
- Required app services/options are wired.

Do not retain the full behavioral suite in both packages after adoption.

### 4. Validate the app independently

From `packages/carmbo/carmbo-app`:

```bash
pnpm build
pnpm test
```

Run the smallest relevant scripts first, then the full package build/test. Verify the exact route
prefixes, auth behavior, localization, and one real cross-domain use of the extracted service.

## Common mistakes

- Exporting only a route while other domains import executors, registries, submitters, or types.
- Updating the app before publishing the new package.
- Depending on unpublished local paths across packages.
- Leaving locale loading in `carmbo-app`.
- Leaving CSS/JS/image URLs pointing at `carmbo-app/src`.
- Omitting a package-local `pnpm start` workflow for interactive browser testing.
- Adding explicit start-server routes for each Bootstrap/HTMX file instead of staging
  `start/dist` and mounting it once with `@fastify/static`.
- Letting generated `start/dist` assets enter Git, ESLint, or the production TypeScript build.
- Putting test reset functions in a production entry point.
- Putting the published testkit under `src/` instead of top-level `testkit/`.
- Exporting mutable registries rather than a narrow reset helper.
- Keeping app-specific request-context access when explicit route options are sufficient.
- Moving only a representative test instead of every owned behavior scenario.
- Combining singular detail tests, plural list tests, and package wiring tests into one large file.
- Assuming row order when test timestamps are tied.
- Removing the old app implementation before the published package has been consumed and tested.

## Completion checklist

### New package

- [ ] Complete domain dependency/import trace performed.
- [ ] Public entry points agreed and explicit.
- [ ] Runtime APIs and public types exported; internals private.
- [ ] Test-only API lives in top-level `testkit/`.
- [ ] Locales and i18next typing are package-owned.
- [ ] Assets are package-owned.
- [ ] `pnpm start` serves the real package routes and staged static assets; `pnpm stop` cleans up.
- [ ] All domain unit and integration scenarios are present.
- [ ] Tests retain singular/plural/wiring file organization.
- [ ] Build, full tests, and pack dry-run pass.
- [ ] Package published by the user and exact version provided.

### `carmbo-app`

- [ ] Published dependency installed.
- [ ] Every production and test import rewired.
- [ ] Route/auth/API prefixes preserved.
- [ ] App locale and asset ownership removed.
- [ ] Old domain source removed.
- [ ] Duplicate behavior tests removed; app smoke wiring retained if useful.
- [ ] App build and full tests pass.
