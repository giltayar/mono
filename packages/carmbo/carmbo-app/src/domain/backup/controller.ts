import {backupDatabase} from './model.ts'

export async function createDatabaseBackup(
  connectionString: string | undefined,
  backupFile: string | undefined,
): Promise<void> {
  await backupDatabase({connectionString, backupFile})
}
