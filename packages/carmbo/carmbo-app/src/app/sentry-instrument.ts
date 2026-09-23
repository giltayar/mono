import * as Sentry from '@sentry/node'
import pkg from '../../package.json' with {type: 'json'}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
  integrations: [Sentry.pinoIntegration()],
  release: `${pkg.name.split('/')[1]}-${process.env.UI_CONFIGURATION ?? 'carmel'}@${pkg.version}`,
  environment: process.env.NODE_ENV || 'development',
})
