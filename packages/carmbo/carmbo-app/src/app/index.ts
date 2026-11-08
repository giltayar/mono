import process from 'node:process'
import {makeApp, RESEND_WEBHOOK_PATH} from './carmbo-app.ts'
import {createResendEmailService} from '@giltayar/carmbo-pages-community/email/service'
import {createAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import {createWhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'
import {createSmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import {createRavmesserIntegrationService} from '@giltayar/carmel-tools-ravmesser-integration/service'
import {throw_, when} from '@giltayar/functional-commons'
import {createCardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import {prepareDatabase} from './prepare-database.ts'
import {initializeAppI18next} from './i18next.ts'
import {EnvironmentVariablesSchema} from './environment.ts'
import {createSkoolIntegrationService} from '@giltayar/carmel-tools-skool-integration/service'

const env = EnvironmentVariablesSchema.parse(
  process.env.NODE_ENV === 'production'
    ? process.env
    : {
        ...process.env,
        SMOOVE_API_KEY:
          process.env.SMOOVE_TEST_API_KEY ?? throw_(new Error('SMOOVE_TEST_API_KEY is not set')),
      },
)

const appBaseUrl = env.APP_BASE_URL
  ? env.APP_BASE_URL
  : `http://${env.HOST.includes(':') ? `[${env.HOST}]` : env.HOST}:${env.PORT}`

// The environment schema guarantees the https base URL, API key, and sender with communities.
const emailService = env.WITH_COMMUNITIES
  ? await createResendEmailService({
      apiKey: env.RESEND_API_KEY ?? throw_(new Error('RESEND_API_KEY is not set')),
      webhookUrl: `${appBaseUrl.replace(/\/+$/, '')}${RESEND_WEBHOOK_PATH}`,
    })
  : undefined

const {app, sql} = await makeApp({
  db: {
    connectionString: env.DB_CONNECTION_STRING,
    database: env.DB_DATABASE,
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    backupFile: env.DB_BACKUP_FILE,
  },
  services: {
    academyIntegration: when(env.ACADEMY_ACCOUNTS_APIKEYS, (accounts) =>
      createAcademyIntegrationService({accounts}),
    ),
    academyAccountSubdomains: env.ACADEMY_ACCOUNTS_APIKEYS?.map((a) => a.subdomain),
    whatsappIntegration: createWhatsAppIntegrationService({
      greenApiKey: env.GREEN_API_KEY,
      greenApiInstanceId: env.GREEN_API_INSTANCE,
      greenApiBaseUrl: new URL(env.GREEN_API_BASE_URL),
    }),
    smooveIntegration: when(env.SMOOVE_API_KEY, (apiKey) =>
      createSmooveIntegrationService({
        apiKey,
        apiUrl: env.SMOOVE_API_URL,
      }),
    ),
    ravmesserIntegration:
      env.RAVMESSER_CLIENT_ID &&
      env.RAVMESSER_CLIENT_SECRET &&
      env.RAVMESSER_USER_TOKEN &&
      env.RAVMESSER_BIRTHDAY_PERSONAL_FIELD_ID
        ? createRavmesserIntegrationService({
            clientId: env.RAVMESSER_CLIENT_ID,
            clientSecret: env.RAVMESSER_CLIENT_SECRET,
            userToken: env.RAVMESSER_USER_TOKEN,
            birthdayPersonalFieldId: env.RAVMESSER_BIRTHDAY_PERSONAL_FIELD_ID,
          })
        : undefined,
    cardcomIntegration: createCardcomIntegrationService({
      apiKey: env.CARDCOM_API_KEY,
      apiKeyPassword: env.CARDCOM_API_KEY_PASSWORD,
      terminalNumber: env.CARDCOM_TERMINAL_NUMBER.toString(),
    }),
    skoolIntegration: when(env.SKOOL_API_UNIQUE_INVITE_LINK_URL, (skoolApiUniqueInviteLinkUrl) =>
      createSkoolIntegrationService({
        skoolApiUniqueInviteLinkUrl: new URL(skoolApiUniqueInviteLinkUrl),
      }),
    ),
    nowService: () => new Date(),
  },
  firebase: env.FORCE_NO_AUTH
    ? undefined
    : {
        apiKey: env.CARMBO_FIREBASE_API_KEY,
        serviceAccountJson: env.CARMBO_FIREBASE_SERVICE_ACCOUNT_JSON,
      },
  apiSecret: env.CARMBO_API_SECRET,
  appBaseUrl: appBaseUrl,
  uiConfiguration: env.UI_CONFIGURATION,
  communities: emailService
    ? {
        emailService,
        webhookSigningSecret: emailService.webhookSigningSecret,
        emailFrom: env.RESEND_FROM ?? throw_(new Error('RESEND_FROM is not set')),
        emailLanguage: process.env.LANGUAGE === 'he' ? 'he' : 'en',
      }
    : undefined,
})

if (emailService) {
  // The creator owns the webhook; a process killed without closing leaves it for the next
  // startup, which deletes it before registering its own.
  app.addHook('onClose', () => emailService.dispose())
}

await prepareDatabase(sql)

await initializeAppI18next(process.env.LANGUAGE)

await app.listen({port: env.PORT, host: env.HOST})
