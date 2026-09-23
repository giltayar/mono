import {x} from 'tinyexec'

const backupScript = `set -e
eval "$(sentry bash-hook)"
pg_dump "$DB_CONNECTION_STRING" --file "$DB_BACKUP_FILE"`

export async function backupDatabase({
  connectionString,
  backupFile,
}: {
  connectionString: string | undefined
  backupFile: string | undefined
}): Promise<void> {
  if (!connectionString) {
    throw new Error('DB_CONNECTION_STRING must be set to create a database backup')
  }
  if (!backupFile) {
    throw new Error('DB_BACKUP_FILE must be set to create a database backup')
  }

  await x('/bin/bash', ['-c', backupScript], {
    throwOnError: true,
    nodeOptions: {
      env: {
        ...process.env,
        DB_CONNECTION_STRING: connectionString,
        DB_BACKUP_FILE: backupFile,
      },
    },
  })
}
