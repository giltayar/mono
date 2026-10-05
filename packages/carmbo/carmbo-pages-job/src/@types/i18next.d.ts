import enJob from '../locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      job: typeof enJob
    }
  }
}
