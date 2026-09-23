# http-commons

## Database backup

Send a `POST` request to `/backup/db-backup?secret=<CARMBO_API_SECRET>` to create a PostgreSQL
backup. The route runs `pg_dump` with `DB_CONNECTION_STRING` and writes the result to
`DB_BACKUP_FILE`, which defaults to `/db-backup/db-backup.sql`.

The application image includes the Sentry CLI and runs the backup under `sentry bash-hook`, using
`SENTRY_DSN` to report command failures.
