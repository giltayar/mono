import enEmail from '../emails/locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      email: typeof enEmail
    }
  }
}
