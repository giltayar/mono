import enStudent from '../domain/student/locale/en.json'
import type {LayoutResources} from '@giltayar/carmbo-common/layout/resources'
import enProduct from '../domain/product/locale/en.json'
import enSalesEvent from '../domain/sales-event/locale/en.json'
import enSales from '../domain/sale/locale/en.json'
import enJob from '../domain/job/locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      student: typeof enStudent
      layout: LayoutResources
      product: typeof enProduct
      'sales-event': typeof enSalesEvent
      sale: typeof enSales
      job: typeof enJob
    }
  }
}
