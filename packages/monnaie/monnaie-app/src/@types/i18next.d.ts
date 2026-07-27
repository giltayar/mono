import type enLayout from '../layout/locale/en.json'
import type enCalculator from '../domain/calculator/locale/en.json'
import type enLogin from '../domain/login/locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'layout'
    // English is the source of truth for the keys; `test/unit/commons/locale-completeness.test.ts`
    // checks that the other languages have exactly the same keys
    resources: {
      layout: typeof enLayout
      calculator: typeof enCalculator
      login: typeof enLogin
    }
  }
}
