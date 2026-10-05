import assert from 'node:assert/strict'
import test from 'node:test'
import * as saleRoutes from '@giltayar/carmbo-pages-sale/routes'
import * as newProductPageModel from '@giltayar/carmbo-pages-sale/testkit/page-model/products/new-product-page.model'
import * as newSalesEventPageModel from '@giltayar/carmbo-pages-sale/testkit/page-model/sales-events/new-sales-event-page.model'
import * as newSalePageModel from '@giltayar/carmbo-pages-sale/testkit/page-model/sales/new-sale-page.model'

test('publishes the intended package entry points', () => {
  assert.deepEqual(Object.keys(saleRoutes), ['apiRoutes', 'landingPageRoutes', 'pageRoutes'])
  assert.deepEqual(Object.keys(newProductPageModel), ['createNewProductPageModel'])
  assert.deepEqual(Object.keys(newSalesEventPageModel), ['createNewSalesEventPageModel'])
  assert.deepEqual(Object.keys(newSalePageModel), ['createNewSalePageModel'])
})
