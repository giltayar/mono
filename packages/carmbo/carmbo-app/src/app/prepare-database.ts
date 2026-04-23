import {fileURLToPath} from 'node:url'
import {migrate} from '../sql/migration.ts'
import type {Sql} from 'postgres'

export async function prepareDatabase(sql: Sql) {
  await migrate({sql, path: fileURLToPath(new URL('../sql', import.meta.url))})
}
