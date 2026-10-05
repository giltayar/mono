import enStudent from '../locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      student: typeof enStudent
    }
  }
}
