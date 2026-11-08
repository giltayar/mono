import * as z from 'zod'

export const EnvironmentVariablesSchema = z
  .object({
    DB_CONNECTION_STRING: z.string().optional(),
    DB_BACKUP_FILE: z.string().default('/db-backup/db-backup.sql'),
    DB_DATABASE: z.string().default('carmbo'),
    DB_HOST: z.string().default('localhost'),
    DB_PORT: z.coerce.number().default(5432),
    DB_USERNAME: z.string().default('user'),
    DB_PASSWORD: z.string().default('password'),
    APP_BASE_URL: z.string().optional(),
    HOST: z.string().default('localhost'),
    PORT: z.coerce.number().default(3000),
    ACADEMY_ACCOUNTS_APIKEYS: z
      .string()
      .optional()
      .transform((value) =>
        value
          ? value.split(',').map((entry) => {
              const [subdomain, apiKey] = entry.split(':')
              return {subdomain, apiKey}
            })
          : undefined,
      ),
    GREEN_API_BASE_URL: z.url().default('https://7105.api.greenapi.com'),
    GREEN_API_KEY: z.string(),
    GREEN_API_INSTANCE: z.coerce.number(),
    SMOOVE_API_KEY: z.string().optional(),
    SMOOVE_API_URL: z.url().optional().default('https://rest.smoove.io/v1/'),
    RAVMESSER_CLIENT_ID: z.string().optional(),
    RAVMESSER_CLIENT_SECRET: z.string().optional(),
    RAVMESSER_USER_TOKEN: z.string().optional(),
    RAVMESSER_BIRTHDAY_PERSONAL_FIELD_ID: z.coerce.number().int().positive().optional(),
    FORCE_NO_AUTH: z.string().optional(),
    CARMBO_FIREBASE_API_KEY: z.string(),
    CARMBO_FIREBASE_SERVICE_ACCOUNT_JSON: z.string(),
    CARMBO_API_SECRET: z.string(),
    CARDCOM_API_KEY: z.string(),
    CARDCOM_API_KEY_PASSWORD: z.string(),
    CARDCOM_TERMINAL_NUMBER: z.coerce.number().default(150067),
    SKOOL_API_UNIQUE_INVITE_LINK_URL: z.url().optional(),
    UI_CONFIGURATION: z.string().optional().default('carmel'),
    WITH_COMMUNITIES: z.stringbool().default(false),
    // Full-access key: the app registers its own delivery webhook. Required with communities.
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.WITH_COMMUNITIES) return
    // Communities send registration emails, and Resend's delivery callbacks are registered under
    // APP_BASE_URL, so it must be the app's public https address.
    if (!/^https:\/\/[^/]/.test(env.APP_BASE_URL ?? '')) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_BASE_URL'],
        message:
          'APP_BASE_URL must be the public https URL of the app when WITH_COMMUNITIES is enabled',
      })
    }
    for (const name of ['RESEND_API_KEY', 'RESEND_FROM'] as const) {
      if (!env[name]?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: `${name} is required when WITH_COMMUNITIES is enabled`,
        })
      }
    }
  })
