import type {Sql} from 'postgres'

export async function prepareDatabase(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS calculation (
      id SERIAL PRIMARY KEY,
      expression TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
}
