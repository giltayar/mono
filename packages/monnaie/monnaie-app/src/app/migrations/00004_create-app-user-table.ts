import {sql, type Kysely} from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // named `app_user` and not `user`, which is a reserved SQL keyword that would have to be quoted
  // in every hand-written query
  await db.schema
    .createTable('app_user')
    .addColumn('user_id', 'text', (column) => column.primaryKey())
    .addColumn('settings', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('app_user').execute()
}
