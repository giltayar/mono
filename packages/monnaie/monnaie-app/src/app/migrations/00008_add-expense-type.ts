import {sql, type Kysely} from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createType('expense_type')
    .asEnum(['day-to-day', 'special', 'recurring'])
    .execute()

  await db.schema
    .alterTable('expense')
    .addColumn('expense_type', sql`expense_type`, (column) =>
      column.notNull().defaultTo('day-to-day'),
    )
    .execute()

  await sql`update expense set expense_type = 'recurring' where recurring = true`.execute(db)
  await db.schema.alterTable('expense').dropColumn('recurring').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('expense')
    .addColumn('recurring', 'boolean', (column) => column.notNull().defaultTo(false))
    .execute()

  await sql`update expense set recurring = true where expense_type = 'recurring'`.execute(db)
  await db.schema.alterTable('expense').dropColumn('expense_type').execute()
  await db.schema.dropType('expense_type').execute()
}
