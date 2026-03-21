import enStudent from '../domain/student/locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      student: typeof enStudent
    }
  }
}
