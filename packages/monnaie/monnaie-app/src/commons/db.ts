import {Kysely, PostgresDialect, type ColumnType, type Generated, type JSONColumnType} from 'kysely'
import pg from 'pg'
import type {Language} from './i18n.ts'

export type CalculationTable = {
  id: Generated<number>
  user_id: string
  expression: string
  value: string
  created_at: ColumnType<Date, string | undefined, never>
}

/**
 * Everything a user can choose about how the app behaves for them, held as a single `jsonb` column
 * so that a new setting is a change to this type and not a migration. Every field is optional: a
 * row that has never chosen anything is `{}`.
 */
export type UserSettings = {
  language?: Language
}

/**
 * A user of the app. Firebase remains the source of truth for who exists and how they authenticate
 * — this table only holds what is ours to keep. A row is created by registration, and by the first
 * login of a user who was created directly in Firebase.
 */
export type AppUserTable = {
  user_id: string
  // selected as the parsed object, but written as a JSON string
  settings: JSONColumnType<UserSettings>
  created_at: ColumnType<Date, string | undefined, never>
}

export type Database = {
  calculation: CalculationTable
  app_user: AppUserTable
}

export type Db = Kysely<Database>

export function createDb(connectionString: string): Db {
  return new Kysely<Database>({
    dialect: new PostgresDialect({pool: new pg.Pool({connectionString})}),
  })
}
