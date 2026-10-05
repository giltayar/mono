import type {LayoutResources} from '@giltayar/carmbo-commons/layout/resources'
import enProduct from '../domain/product/locale/en.json'
import enSalesEvent from '../domain/sales-event/locale/en.json'
import enSale from '../domain/sale/locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      layout: LayoutResources
      product: typeof enProduct
      'sales-event': typeof enSalesEvent
      sale: typeof enSale
    }
  }
}
