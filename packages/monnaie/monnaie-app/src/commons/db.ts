import {Kysely, PostgresDialect, type ColumnType, type Generated, type JSONColumnType} from 'kysely'
import pg from 'pg'
import type {Language} from './i18n.ts'

/**
 * A single expense of a single user. `category_id` deliberately refers to a number and not to a
 * name, so that categories can become per-user rows without touching the expenses pointing at them.
 * `amount` is `numeric` in the database, which `pg` hands back as a string to keep it exact — the
 * model is what turns it into a number.
 */
export type ExpenseTable = {
  id: Generated<number>
  user_id: string
  description: string
  amount: ColumnType<string, number, number>
  category_id: number
  expense_type: 'day-to-day' | 'special' | 'recurring'
  created_at: ColumnType<Date, string | undefined, string>
}

/**
 * Everything a user can choose about how the app behaves for them, held as a single `jsonb` column
 * so that a new setting is a change to this type and not a migration. Every field may be
 * `undefined`: a row that has never chosen anything is `{}` in the database.
 */
export type UserSettings = {
  language: Language | undefined
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
  expense: ExpenseTable
  app_user: AppUserTable
}

export type Db = Kysely<Database>

export function createDb(connectionString: string): Db {
  return new Kysely<Database>({
    dialect: new PostgresDialect({pool: new pg.Pool({connectionString})}),
  })
}
