import enCommunity from '../locale/en.json'
import enEmail from '../email/locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      community: typeof enCommunity
      email: typeof enEmail
    }
  }
}
