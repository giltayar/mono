import enAuth from '../locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      auth: typeof enAuth
    }
  }
}
