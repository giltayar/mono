import {sql} from 'kysely'
import * as z from 'zod'
import type {Db, UserSettings} from '../../commons/db.ts'
import {SUPPORTED_LANGUAGES} from '../../commons/i18n.ts'

/**
 * A domain with nothing but a model: the app's own record of a user, which the login domain
 * creates and the language domain writes to, and which has no pages of its own.
 */

// the column is `jsonb`, so what comes back is whatever was written into it — possibly by an older
// version of this app. `catch` makes a row we cannot understand read as "nothing chosen yet"
// instead of failing the request that happened to load it.
const UserSettingsSchema = z.object({language: z.enum(SUPPORTED_LANGUAGES).optional()}).catch({})

/** The settings a stored value stands for, and no settings at all when it stands for nothing we know */
export function parseUserSettings(settings: unknown): UserSettings {
  // spelled out field by field, so that a key the schema left out is `undefined` rather than absent
  return {language: UserSettingsSchema.parse(settings).language}
}

/**
 * Creates the row of a user who does not have one yet, leaving an existing row untouched. Called on
 * registration, and on every login, since a user may have been created directly in Firebase.
 */
export async function ensureUser(db: Db, userId: string, settings: UserSettings): Promise<void> {
  await db
    .insertInto('app_user')
    .values({user_id: userId, settings: JSON.stringify(settings)})
    .onConflict((conflict) => conflict.column('user_id').doNothing())
    .execute()
}

/** The settings of a user, or none at all when the user has no row yet */
export async function userSettings(db: Db, userId: string): Promise<UserSettings> {
  const row = await db
    .selectFrom('app_user')
    .select('settings')
    .where('user_id', '=', userId)
    .executeTakeFirst()

  return parseUserSettings(row?.settings ?? {})
}

/**
 * Merges `settings` into what the user already has, so that writing one setting never drops
 * another.
 */
export async function updateUserSettings(
  db: Db,
  userId: string,
  settings: UserSettings,
): Promise<void> {
  await db
    .updateTable('app_user')
    .set({settings: sql`settings || ${JSON.stringify(settings)}::jsonb`})
    .where('user_id', '=', userId)
    .execute()
}
