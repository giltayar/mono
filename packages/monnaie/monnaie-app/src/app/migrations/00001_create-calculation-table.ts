import type {Kysely} from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('calculation')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('expression', 'text', (column) => column.notNull())
    .addColumn('value', 'text', (column) => column.notNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('calculation').execute()
}
