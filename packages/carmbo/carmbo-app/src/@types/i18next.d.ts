import enStudent from '../domain/student/locale/en.json'
import enLayout from '../layout/locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      student: typeof enStudent
      layout: typeof enLayout
    }
  }
}
