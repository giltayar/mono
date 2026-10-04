# carmbo-common

Shared Carmbo helpers, provider caches, test hooks, layout rendering, translations, assets,
and the complete database migration history.
The package preserves the existing Carmbo navigation and Carmel/Liraz branding; it is not a
general-purpose layout framework.

## Installation and imports

Install the published package from the authenticated GitHub Packages registry:

```sh
pnpm add @giltayar/carmbo-common
```

The app must also install compatible versions of the `fastify`, `@fastify/request-context`,
and `i18next` peer dependencies. Sharing i18next and request-context with the app is essential:
the layout uses the app's translation state, and test hooks use its active request context.

Import individual modules, without file extensions:

```ts
import {normalizePhoneNumber} from '@giltayar/carmbo-common/commons/normalize-input'
import {html} from '@giltayar/carmbo-common/commons/html-templates'
import {MainLayout} from '@giltayar/carmbo-common/layout/main-view'
import {exceptionToBanner} from '@giltayar/carmbo-common/layout/banner'
```

All existing `commons` modules retain their module names, including
`commons/external-provider/smoove-lists`, `ravmesser-lists`, and `whatsapp-groups`.
Exports resolve to compiled JavaScript and declarations, not TypeScript inside node_modules.

## Application initialization

Initialize the app version, branding, and translation state before rendering:

```ts
import {initializei18next} from '@giltayar/carmbo-common/commons/i18next-utils'
import {setVersion} from '@giltayar/carmbo-common/commons/version'
import {setUiConfiguration} from '@giltayar/carmbo-common/commons/ui-configuration'
import appPackage from '../../package.json' with {type: 'json'}

setVersion(appPackage.version)
setUiConfiguration('carmel') // or 'liraz'
await initializei18next(process.env.LANGUAGE, {
  root: new URL('../domain/', import.meta.url),
  namespaces: ['student', 'product', 'sales-event', 'sale', 'job', 'auth'],
})
```

The example assumes an initialization module under the app's `src/app/`. The locale root is a
directory URL (with a trailing slash), containing `<namespace>/locale/<language>.json`.
Omit the second argument for layout-only localization. The language defaults to English.
Layout translations and logos are resolved relative to this package, not the working directory.

`getVersion()` returns the configured **application** version, not this package's version.
Use it for app-specific asset links too. It throws if the version was not configured.
Unknown brands throw rather than silently choosing a different logo. Version, branding,
translations, and provider caches retain their existing process-global behavior; apps needing
different configurations must run in separate processes.

For app translation typing, compose the exported layout resource type into the app's existing
i18next declaration rather than declaring another competing resource map:

```ts
import type {LayoutResources} from '@giltayar/carmbo-common/layout/resources'
import type enStudent from '../domain/student/locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      layout: LayoutResources
      student: typeof enStudent
      // Include the app's other namespaces here.
    }
  }
}
```

The shared hook module owns `RequestContextData.TEST_hooks`. The app should retain declarations
for its own database/services, but remove its duplicate declaration of this field.

## Serving assets

The app continues to build/serve Bootstrap and HTMX under `/dist/<app-version>/` and its own
domain assets under `/src/<app-version>/domain/`. Register the shared asset routes at the
existing layout URLs after calling `setVersion`:

```ts
import {layoutAssetRoutes} from '@giltayar/carmbo-common/layout/assets'

app.register(layoutAssetRoutes)
```

The plugin serves `/src/<app-version>/layout/style/` and `/src/<app-version>/layout/js/`
with immutable, one-year caching and allows only JS, CSS, PNG, and SVG files. It does not
decorate replies, so it can coexist with the app's own static routes. `@fastify/static`
is included as a runtime dependency. Asset roots are internal implementation details and
are not exported through the package API. Consumers of the former `layoutStyleRoot` and
`layoutScriptRoot` exports must switch to `layoutAssetRoutes`; removing those exports is
a breaking change.

Do not serve the entire package or its compiled layout directory: those also contain server
modules and translations. The two public roots contain only the browser assets; the filter
also keeps generated declarations/source maps private.

## Database migrations

The package owns all 44 existing schema/data migrations, the migration runner, and the manual
maintenance SQL. Run the packaged migrations against an app-provided postgres client:

```ts
import {migrate, migrationsRoot} from '@giltayar/carmbo-common/sql/migration'

await migrate({sql})
// Equivalent explicit location:
await migrate({sql, path: migrationsRoot})
```

`migrationsRoot` is a directory URL pointing to the installed migration files. The default no
longer depends on the app's source tree or working directory. The optional `path` still accepts
a filesystem path or URL for custom migration directories.

Migration 27 is compiled from TypeScript to JavaScript for execution inside node_modules.
Discovery ignores declarations and source maps, preserves the numbered migration order, and
uses the existing database migration records to avoid rerunning applied migrations.
Maintenance SQL is included under `maintenance/` but is never run automatically.

## Development and verification

```sh
pnpm install
pnpm build
pnpm test
```

The build emits JavaScript/declarations with TypeScript 7 and copies layout translations, CSS, icons,
logos, and SQL files into `dist`. Tests include the extracted phone-normalization suite,
source-level runtime-boundary tests, and a consumer test importing the compiled package through
its exports. Build before running tests. `test:integration` requires Docker and runs PostgreSQL
17 in an isolated container to test schema creation, upgrades, idempotency, and migration discovery.

The TypeScript dependency aliases are deliberate: `@typescript/native` provides the TypeScript 7
`tsc` binary used by builds and type-checking, while `typescript` resolves to TypeScript 6 so
typescript-eslint can load the compiler API version it supports.

For an isolated packaging check, use `pnpm pack`, install the tarball into a temporary consumer
outside this package, and copy/run `test/unit/consumer.test.ts` there. That consumer needs
the peer dependencies and `@fastify/static` (used to test coexistence with app-owned static routes);
type-checking also needs `@types/node` and TypeScript.
Run the consumer test from that directory to verify installed imports, shared runtime state,
translations, branding, static asset contents, and cache headers without source-tree access.
To verify installed migrations against PostgreSQL too, copy the files from `test/integration/sql/`
into the consumer, install `postgres` and `@giltayar/docker-compose-testkit`, and run
`NODE_ENV=test node --test migration.test.ts`.

## Publishing and migrating carmbo-app

This package is independent: no workspace linking or relative imports across package boundaries.
Publish it to restricted GitHub Packages with `pnpm publish` after validation.

The initial extraction intentionally leaves carmbo-app unchanged until that publication.
After the user publishes:

1. Install the published version in carmbo-app.
2. Replace the old commons/layout/sql imports and wire configuration, typing, and asset roots.
   Update app database preparation and all test setups to call the packaged `migrate({sql})`
   instead of passing the app-local SQL directory.
3. Remove the old directories and their dedicated phone test from the app.
4. Run app build, lint, type checks, Node tests, and browser integration tests.

App integration fixtures and page models stay in carmbo-app because they exercise its domains,
database, and service integrations.
