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
import {finalHtml, type ControllerResult, retarget} from '../../commons/controller-result.ts'
import type {ProductManipulations} from './view/product-manipulations.ts'
import {requestContext} from '@fastify/request-context'
import {exceptionToBanner} from '../../layout/banner.ts'
import {listAcademyCourses} from '../../commons/external-provider/academy-courses.ts'
import {listWhatsAppGroups} from '../../commons/external-provider/whatsapp-groups.ts'
import {
  listSmooveLists,
  invalidateSmooveListsCache,
} from '../../commons/external-provider/smoove-lists.ts'
import {submitPropagateAcademyCourseChangesJob} from '../sale/model/model-external-providers.ts'
import {
  renderSmooveListCreateDialog,
  renderSmooveListCreateResult,
  renderSmooveListCreateError,
} from './view/smoove-list-dialog.ts'
import {when} from '@giltayar/functional-commons'

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

export async function showProductCreate(
  product: NewProduct | undefined,
  {error}: {error?: any},
): Promise<ControllerResult> {
  const academyIntegration = requestContext.get('academyIntegration')
  const whatsappIntegration = requestContext.get('whatsappIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const nowService = requestContext.get('nowService')!
  const now = nowService()

  const [courses, whatsappGroups, smooveLists] = await Promise.all([
    when(academyIntegration, (academyIntegration) => listAcademyCourses(academyIntegration, now)),
    listWhatsAppGroups(whatsappIntegration, now),
    when(smooveIntegration, (smooveIntegration) => listSmooveLists(smooveIntegration, now)),
  ])
  requestContext.set('courses', courses)
  requestContext.set('whatsappGroups', whatsappGroups)
  requestContext.set('smooveLists', smooveLists)

  const banner = exceptionToBanner('Creating product error: ', error)

  return finalHtml(
    renderProductsCreatePage(product, {
      banner,
      withAcademyIntegration: Boolean(academyIntegration),
      withSmooveIntegration: Boolean(smooveIntegration),
    }),
  )
}

export async function showProductUpdate(
  productNumber: number,
  productWithError: {product: Product | undefined; error: any; operation: string} | undefined,
  sql: Sql,
): Promise<ControllerResult> {
  const academyIntegration = requestContext.get('academyIntegration')
  const whatsappIntegration = requestContext.get('whatsappIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const nowService = requestContext.get('nowService')!
  const now = nowService()

  const [courses, whatsappGroups, smooveLists, productWithHistory] = await Promise.all([
    when(academyIntegration, (academyIntegration) => listAcademyCourses(academyIntegration, now)),
    listWhatsAppGroups(whatsappIntegration, now),
    when(smooveIntegration, (smooveIntegration) => listSmooveLists(smooveIntegration, now)),
    queryProductByNumber(productNumber, sql),
  ])
  requestContext.set('courses', courses)
  requestContext.set('whatsappGroups', whatsappGroups)
  requestContext.set('smooveLists', smooveLists)

  if (!productWithHistory) {
    return {status: 404, body: 'Product not found'}
  }

  const banner = exceptionToBanner(
    `${productWithError?.operation} product error: `,
    productWithError?.error,
  )
  productWithHistory.product = {
    ...productWithHistory.product,
    ...productWithError?.product,
  }

  return finalHtml(
    renderProductUpdatePage(productWithHistory.product, productWithHistory.history, {
      banner,
      withAcademyIntegration: Boolean(academyIntegration),
      withSmooveIntegration: Boolean(smooveIntegration),
    }),
  )
}

export async function showOngoingProduct(
  product: OngoingProduct,
  {manipulations}: {manipulations: ProductManipulations},
): Promise<ControllerResult> {
  const academyIntegration = requestContext.get('academyIntegration')
  const whatsappIntegration = requestContext.get('whatsappIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const nowService = requestContext.get('nowService')!
  const now = nowService()

  const [courses, whatsappGroups, smooveLists] = await Promise.all([
    when(academyIntegration, (academyIntegration) => listAcademyCourses(academyIntegration, now)),
    listWhatsAppGroups(whatsappIntegration, now),
    when(smooveIntegration, (smooveIntegration) => listSmooveLists(smooveIntegration, now)),
  ])
  requestContext.set('courses', courses)
  requestContext.set('whatsappGroups', whatsappGroups)
  requestContext.set('smooveLists', smooveLists)

  return finalHtml(
    renderProductFormFields(product, manipulations, 'write', {
      withAcademyIntegration: Boolean(academyIntegration),
      withSmooveIntegration: Boolean(smooveIntegration),
    }),
  )
}

export async function showProductInHistory(
  productNumber: number,
  operationId: string,
  sql: Sql,
): Promise<ControllerResult> {
  const academyIntegration = requestContext.get('academyIntegration')
  const whatsappIntegration = requestContext.get('whatsappIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const nowService = requestContext.get('nowService')!
  const now = nowService()

  const [courses, whatsappGroups, smooveLists, product] = await Promise.all([
    when(academyIntegration, (academyIntegration) => listAcademyCourses(academyIntegration, now)),
    listWhatsAppGroups(whatsappIntegration, now),
    when(smooveIntegration, (smooveIntegration) => listSmooveLists(smooveIntegration, now)),
    queryProductByHistoryId(productNumber, operationId, sql),
  ])
  requestContext.set('courses', courses)
  requestContext.set('whatsappGroups', whatsappGroups)
  requestContext.set('smooveLists', smooveLists)

  if (!product) {
    return {status: 404, body: 'Product not found'}
  }

  return finalHtml(
    renderProductViewInHistoryPage(product.product, product.history, {
      withAcademyIntegration: Boolean(academyIntegration),
      withSmooveIntegration: Boolean(smooveIntegration),
    }),
  )
}

export async function createProduct(product: NewProduct, sql: Sql): Promise<ControllerResult> {
  try {
    const nowService = requestContext.get('nowService')!
    const productNumber = await model_createProduct(product, undefined, nowService(), sql)

    return {htmxRedirect: `/products/${productNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, 'create-product')

    return showProductCreate(product, {error})
  }
}

export async function updateProduct(product: Product, sql: Sql): Promise<ControllerResult> {
  try {
    const nowService = requestContext.get('nowService')!
    const updateResult = await model_updateProduct(product, undefined, nowService(), sql)

    if (!updateResult) {
      return {status: 404, body: 'Product not found'}
    }

    // Propagate academy course changes to connected sales via job system
    if (
      updateResult.addedAcademyCourses.length > 0 ||
      updateResult.removedAcademyCourses.length > 0
    ) {
      await submitPropagateAcademyCourseChangesJob(
        {
          productNumber: updateResult.productNumber,
          addedCourses: updateResult.addedAcademyCourses,
          removedCourses: updateResult.removedAcademyCourses,
        },
        {},
      )
    }

    return {htmxRedirect: `/products/${updateResult.productNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, 'update-product')
    return showProductUpdate(product.productNumber, {product, error, operation: 'Updating'}, sql)
  }
}

export async function deleteProduct(
  productNumber: number,
  deleteOperation: 'delete' | 'restore',
  sql: Sql,
): Promise<ControllerResult> {
  try {
    const nowService = requestContext.get('nowService')!
    const operationId = await model_deleteProduct(
      productNumber,
      undefined,
      deleteOperation,
      nowService(),
      sql,
    )

    if (!operationId) {
      return {status: 404, body: 'Product not found'}
    }

    return {htmxRedirect: `/products/${productNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, `${deleteOperation}-product`)
    const operation = deleteOperation === 'delete' ? 'Archiving' : 'Restoring'
    return retarget(
      await showProductUpdate(productNumber, {product: undefined, error, operation}, sql),
      'body',
    )
  }
}

export async function showSmooveListCreateDialog(targetFieldId: string): Promise<ControllerResult> {
  return finalHtml(renderSmooveListCreateDialog(targetFieldId))
}

export async function createSmooveList(listName: string): Promise<ControllerResult> {
  const smooveIntegration = requestContext.get('smooveIntegration')
  const logger = requestContext.get('logger')!

  try {
    if (!smooveIntegration) {
      throw new Error('Smoove integration is not configured')
    }
    const listId = await smooveIntegration.createList(listName)
    invalidateSmooveListsCache()

    return finalHtml(renderSmooveListCreateResult(listId, listName))
  } catch (error) {
    logger.error({err: error}, 'create-smoove-list')
    return finalHtml(renderSmooveListCreateError(String(error)))
  }
}
