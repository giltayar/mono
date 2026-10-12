# carmbo-app

## Shared code and database migrations

The app depends on the published `@giltayar/carmbo-common` package for shared helpers, layout,
branding assets, layout translations, and the complete SQL migration history. Import its
`commons/*`, `layout/*`, and `sql/migration` subpaths rather than local copies.

App creation supplies the application version and UI configuration to the shared package.
`src/app/i18next.ts` supplies the app's domain locales; layout locales come from the package.
Static serving preserves `/src/<app-version>/layout/` URLs using the package's public asset
roots, while domain assets, Bootstrap, and HTMX remain app-owned.

Database preparation and test setup call the packaged `migrate({sql})`, which locates the
installed migrations without relying on an app-local SQL directory.

To change shared code, build, test, and publish carmbo-common first. Then install that published
version in this package with pnpm, and build/test the app. These packages are independent:
there are no workspace links or relative imports between them.

Build with `pnpm build` before running `pnpm test`; the build also creates the app's Docker image.
The integration tests require Docker/PostgreSQL and Playwright Chromium.
The Docker image installs the exact pnpm version declared in `package.json` before installing
dependencies, so package-manager upgrades invalidate the cached installer layer.

## Community pages

The published `@giltayar/carmbo-pages-community` package owns the community list, create/update
forms, archive/restore actions, history, translations, and assets. Its routes are mounted at
`/communities` in the same Firebase-authenticated scope as students when `WITH_COMMUNITIES=true`.
Communities are disabled by default: unset or `WITH_COMMUNITIES=false` omits both the routes
(including their assets) and the Communities navigation item. Values are parsed with Zod
`stringbool`: `true`, `1`, `yes`, `on`, `y`, and `enabled` enable communities; `false`, `0`, `no`,
`off`, `n`, and `disabled` disable them. Matching is case-insensitive; other values fail startup
validation. This also applies to fake-mode startup.
Set `WITH_COMMUNITIES=true` in the deployed service's environment to enable them, or start locally
with `WITH_COMMUNITIES=true pnpm start`.
The community tables are created by the installed `@giltayar/carmbo-commons@2.2.0` migrations.

## Database backup

Send a `POST` request to `/backup/db-backup?secret=<CARMBO_API_SECRET>` to create a PostgreSQL
backup. The route runs `pg_dump` with `DB_CONNECTION_STRING` and writes the result to
`DB_BACKUP_FILE`, which defaults to `/db-backup/db-backup.sql`.

The application image includes the Sentry CLI and runs the backup under `sentry bash-hook`, using
`SENTRY_DSN` to report command failures.
