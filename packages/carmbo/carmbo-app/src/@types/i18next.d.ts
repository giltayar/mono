import enStudent from '../domain/student/locale/en.json'
import enLayout from '../layout/locale/en.json'
import enProduct from '../domain/product/locale/en.json'
import enSalesEvent from '../domain/salesEvent/locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      student: typeof enStudent
      layout: typeof enLayout
      product: typeof enProduct
      salesEvent: typeof enSalesEvent
    }
  }
}
