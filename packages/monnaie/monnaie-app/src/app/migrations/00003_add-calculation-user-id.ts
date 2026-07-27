import type {Kysely} from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // calculations predate ownership, and there is no user they could be attributed to
  await db.deleteFrom('calculation').execute()

  await db.schema
    .alterTable('calculation')
    .addColumn('user_id', 'text', (column) => column.notNull())
    .execute()

  await db.schema
    .createIndex('calculation_user_id_created_at_index')
    .on('calculation')
    .columns(['user_id', 'created_at'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('calculation_user_id_created_at_index').execute()

  await db.schema.alterTable('calculation').dropColumn('user_id').execute()
}
