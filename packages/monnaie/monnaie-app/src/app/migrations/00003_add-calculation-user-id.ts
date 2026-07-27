import type {Kysely} from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // calculations made before the app had users belong to nobody, and every query from now on is
  // scoped to a user, so there is no way to ever reach them again
  await db.deleteFrom('calculation').execute()

  await db.schema
    .alterTable('calculation')
    .addColumn('user_id', 'text', (column) => column.notNull())
    .execute()

  await db.schema
    .createIndex('calculation_user_id_id_index')
    .on('calculation')
    .columns(['user_id', 'id'])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('calculation_user_id_id_index').execute()
  await db.schema.alterTable('calculation').dropColumn('user_id').execute()
}
