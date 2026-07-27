import {Kysely, PostgresDialect, type ColumnType, type Generated} from 'kysely'
import pg from 'pg'

export type CalculationTable = {
  id: Generated<number>
  user_id: string
  expression: string
  value: string
  created_at: ColumnType<Date, string | undefined, never>
}

export type Database = {
  calculation: CalculationTable
}

export type Db = Kysely<Database>

export function createDb(connectionString: string): Db {
  return new Kysely<Database>({
    dialect: new PostgresDialect({pool: new pg.Pool({connectionString})}),
  })
}
