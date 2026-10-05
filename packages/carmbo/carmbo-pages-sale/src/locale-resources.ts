import i18next from 'i18next'
import enProduct from './domain/product/locale/en.json' with {type: 'json'}
import heProduct from './domain/product/locale/he.json' with {type: 'json'}
import enSalesEvent from './domain/sales-event/locale/en.json' with {type: 'json'}
import heSalesEvent from './domain/sales-event/locale/he.json' with {type: 'json'}
import enSale from './domain/sale/locale/en.json' with {type: 'json'}
import heSale from './domain/sale/locale/he.json' with {type: 'json'}

export function registerSaleLocaleResources(): void {
  i18next.addResourceBundle('en', 'product', enProduct, true, true)
  i18next.addResourceBundle('he', 'product', heProduct, true, true)
  i18next.addResourceBundle('en', 'sales-event', enSalesEvent, true, true)
  i18next.addResourceBundle('he', 'sales-event', heSalesEvent, true, true)
  i18next.addResourceBundle('en', 'sale', enSale, true, true)
  i18next.addResourceBundle('he', 'sale', heSale, true, true)
}
