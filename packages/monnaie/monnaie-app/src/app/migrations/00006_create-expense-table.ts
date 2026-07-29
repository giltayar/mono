import {sql, type Kysely} from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('expense')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('user_id', 'text', (column) => column.notNull())
    .addColumn('description', 'text', (column) => column.notNull())
    // exact decimal arithmetic: money must never go through a binary float
    .addColumn('amount', sql`numeric(12, 2)`, (column) => column.notNull())
    // a number rather than a name, so that categories can become per-user rows later without
    // rewriting the expenses that point at them
    .addColumn('category_id', 'integer', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute()

  // every query is scoped by user and ordered or filtered by time
  await db.schema
    .createIndex('expense_user_id_created_at_index')
    .on('expense')
    .columns(['user_id', 'created_at desc'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('expense_user_id_created_at_index').execute()
  await db.schema.dropTable('expense').execute()
}
