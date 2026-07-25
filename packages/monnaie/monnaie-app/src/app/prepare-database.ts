import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {FileMigrationProvider, Migrator} from 'kysely/migration'
import type {Db} from '../commons/db.ts'

export async function prepareDatabase(db: Db): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: fileURLToPath(new URL('migrations', import.meta.url)),
    }),
  })

  const {error, results} = await migrator.migrateToLatest()

  const failedMigration = results?.find((result) => result.status === 'Error')

  if (error || failedMigration) {
    throw new Error(
      `Database migration failed${failedMigration ? ` at "${failedMigration.migrationName}"` : ''}`,
      {cause: error},
    )
  }
}
