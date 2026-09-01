import type {Kysely} from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('expense')
    .addColumn('recurring', 'boolean', (column) => column.notNull().defaultTo(false))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('expense').dropColumn('recurring').execute()
}
