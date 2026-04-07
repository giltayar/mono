import enStudent from '../domain/student/locale/en.json'
import enLayout from '../layout/locale/en.json'
import enProduct from '../domain/product/locale/en.json'
import enSalesEvent from '../domain/sales-event/locale/en.json'
import enSales from '../domain/sale/locale/en.json'
import enJob from '../domain/job/locale/en.json'
import enAuth from '../domain/auth/locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      student: typeof enStudent
      layout: typeof enLayout
      product: typeof enProduct
      'sales-event': typeof enSalesEvent
      sale: typeof enSales
      job: typeof enJob
      auth: typeof enAuth
    }
  }
}
