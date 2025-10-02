import type {Sql} from 'postgres'

import type {NewProduct, Product} from './model.ts'
import type {OngoingProduct} from './view/model.ts'
import {
  listProducts,
  queryProductByNumber,
  queryProductByHistoryId,
  createProduct as model_createProduct,
  updateProduct as model_updateProduct,
  deleteProduct as model_deleteProduct,
} from './model.ts'
import {
  renderProductsCreatePage,
  renderProductFormFields,
  renderProductUpdatePage,
  renderProductViewInHistoryPage,
} from './view/view.ts'
import {renderProductsPage} from './view/list.ts'
import {finalHtml, type ControllerResult} from '../../commons/controller-result.ts'
import type {ProductManipulations} from './view/product-manipulations.ts'
import type {AcademyCourse} from '@giltayar/carmel-tools-academy-integration/service'
import {requestContext} from '@fastify/request-context'
import type {WhatsAppGroup} from '@giltayar/carmel-tools-whatsapp-integration/service'

export async function showProducts(
  {
    flash,
    withArchived,
    query,
    page,
  }: {flash?: string; withArchived: boolean; query: string | undefined; page: number},
  sql: Sql,
): Promise<ControllerResult> {
  const products = await listProducts(sql, {withArchived, query: query ?? '', limit: 50, page})

  return finalHtml(renderProductsPage(flash, products, {withArchived, query: query ?? '', page}))
}

export async function showProductCreate(): Promise<ControllerResult> {
  const [courses, whatsappGroups] = await Promise.all([listCourses(), listWhatsAppGroups()])
  requestContext.set('courses', courses)
  requestContext.set('whatsappGroups', whatsappGroups)

  return finalHtml(renderProductsCreatePage(undefined, undefined))
}

export async function showProductUpdate(
  productNumber: number,
  manipulations: ProductManipulations,
  sql: Sql,
): Promise<ControllerResult> {
  const [courses, whatsappGroups, productWithHistory] = await Promise.all([
    listCourses(),
    listWhatsAppGroups(),
    queryProductByNumber(productNumber, sql),
  ])
  requestContext.set('courses', courses)
  requestContext.set('whatsappGroups', whatsappGroups)

  if (!productWithHistory) {
    return {status: 404, body: 'Product not found'}
  }
  return finalHtml(
    renderProductUpdatePage(productWithHistory.product, productWithHistory.history, manipulations),
  )
}

export async function showOngoingProduct(
  product: OngoingProduct,
  manipulations: ProductManipulations,
): Promise<ControllerResult> {
  const [courses, whatsappGroups] = await Promise.all([listCourses(), listWhatsAppGroups()])
  requestContext.set('courses', courses)
  requestContext.set('whatsappGroups', whatsappGroups)

  return finalHtml(renderProductFormFields(product, manipulations, 'write'))
}

export async function showProductInHistory(
  productNumber: number,
  operationId: string,
  sql: Sql,
): Promise<ControllerResult> {
  const [courses, whatsappGroups, product] = await Promise.all([
    listCourses(),
    listWhatsAppGroups(),
    queryProductByHistoryId(productNumber, operationId, sql),
  ])
  requestContext.set('courses', courses)
  requestContext.set('whatsappGroups', whatsappGroups)

  if (!product) {
    return {status: 404, body: 'Product not found'}
  }

  return finalHtml(renderProductViewInHistoryPage(product.product, product.history))
}

export async function createProduct(product: NewProduct, sql: Sql): Promise<ControllerResult> {
  const productNumber = await model_createProduct(product, undefined, sql)

  return {htmxRedirect: `/products/${productNumber}`}
}

export async function updateProduct(product: Product, sql: Sql): Promise<ControllerResult> {
  const productNumber = await model_updateProduct(product, undefined, sql)

  if (!productNumber) {
    return {status: 404, body: 'Product not found'}
  }

  return {htmxRedirect: `/products/${productNumber}`}
}

export async function deleteProduct(
  productNumber: number,
  deleteOperation: 'delete' | 'restore',
  sql: Sql,
): Promise<ControllerResult> {
  const operationId = await model_deleteProduct(productNumber, undefined, deleteOperation, sql)

  if (!operationId) {
    return {status: 404, body: 'Product not found'}
  }

  return {htmxRedirect: `/products/${productNumber}`}
}

const cachedCourses: {
  courses: AcademyCourse[] | undefined
  timestamp: number
} = {
  courses: undefined,
  timestamp: 0,
}

async function listCourses() {
  const academyIntegration = requestContext.get('academyIntegration')!

  if (Date.now() - cachedCourses.timestamp > 1 * 60 * 1000 || !cachedCourses.courses) {
    cachedCourses.courses = await academyIntegration.listCourses()
    cachedCourses.timestamp = Date.now()
  }

  return cachedCourses.courses
}

const cachedWhatsAppGroups: {
  groups: WhatsAppGroup[] | undefined
  timestamp: number
} = {
  groups: undefined,
  timestamp: 0,
}

async function listWhatsAppGroups() {
  const whatsappIntegration = requestContext.get('whatsappIntegration')!

  if (Date.now() - cachedWhatsAppGroups.timestamp > 1 * 60 * 1000 || !cachedWhatsAppGroups.groups) {
    cachedWhatsAppGroups.groups = await whatsappIntegration.fetchWhatsAppGroups()
    cachedWhatsAppGroups.timestamp = Date.now()
  }

  return cachedWhatsAppGroups.groups
}
