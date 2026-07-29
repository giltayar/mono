import {sql, type Kysely} from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // the calculator was the scaffold the app was built on, and nothing reads this table anymore
  await db.schema.dropIndex('calculation_user_id_id_index').execute()
  await db.schema.dropTable('calculation').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('calculation')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('expression', 'text', (column) => column.notNull())
    .addColumn('value', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('user_id', 'text', (column) => column.notNull())
    .execute()

  await db.schema
    .createIndex('calculation_user_id_id_index')
    .on('calculation')
    .columns(['user_id', 'id'])
    .execute()
}
