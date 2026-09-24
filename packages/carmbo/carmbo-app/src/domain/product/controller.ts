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
  isValidProduct,
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
import {listWhatsAppGroups} from '../../commons/external-provider/whatsapp-groups.ts'
import {listSmooveLists} from '../../commons/external-provider/smoove-lists.ts'
import {listRavmesserLists} from '../../commons/external-provider/ravmesser-lists.ts'
import {submitPropagateAcademyCourseChangesJob} from '../sale/model/model-external-providers.ts'
import {searchProducts} from '../sale/model/model.ts'
import {when} from '@giltayar/functional-commons'
import type {
  AcademyCourse,
  AcademyIntegrationService,
} from '@giltayar/carmel-tools-academy-integration/service'
import {renderProductListOptions} from './view/list-searches.ts'
import {listAcademyCourses} from '../academy/model.ts'

async function listCoursesForSubdomains(
  academyIntegration: AcademyIntegrationService | undefined,
  subdomains: string[],
  now: Date,
) {
  const result = new Map<string, AcademyCourse[]>()
  if (academyIntegration) {
    await Promise.all(
      subdomains.map(async (subdomain) => {
        const courses = await listAcademyCourses(academyIntegration, subdomain, now)
        result.set(subdomain, courses)
      }),
    )
  }
  return result
}

function getSubdomainsFromProduct(
  product: {
    academyCourses?: ({accountSubdomain?: string} | string)[]
  },
  options: {alsoIncludeFirstSubdomain: boolean},
): string[] {
  const academyAccountSubdomains = requestContext.get('academyAccountSubdomains')

  if (!academyAccountSubdomains) {
    return []
  }

  return [
    ...new Set(
      (product.academyCourses ?? [])
        .map((c) => (typeof c === 'object' ? c.accountSubdomain : undefined))
        .filter((s): s is string => !!s)
        .concat(options.alsoIncludeFirstSubdomain ? [academyAccountSubdomains[0]] : []),
    ),
  ]
}

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
  const academyAccountSubdomains = requestContext.get('academyAccountSubdomains')
  const whatsappIntegration = requestContext.get('whatsappIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const ravmesserIntegration = requestContext.get('ravmesserIntegration')
  const skoolIntegration = requestContext.get('skoolIntegration')
  const nowService = requestContext.get('nowService')!
  const now = nowService()

  const [whatsappGroups, smooveLists, ravmesserLists] = await Promise.all([
    listWhatsAppGroups(whatsappIntegration, now),
    when(smooveIntegration, (smooveIntegration) => listSmooveLists(smooveIntegration, now)),
    when(ravmesserIntegration, (ravmesserIntegration) =>
      listRavmesserLists(ravmesserIntegration, now),
    ),
  ])
  const academyCoursesBySubdomain = await listCoursesForSubdomains(
    academyIntegration,
    getSubdomainsFromProduct(product ?? {}, {alsoIncludeFirstSubdomain: true}),
    now,
  )
  requestContext.set('whatsappGroups', whatsappGroups)
  requestContext.set('smooveLists', smooveLists)
  requestContext.set('ravmesserLists', ravmesserLists)

  const banner = when(error, (error) => exceptionToBanner('Creating product error: ', error))

  return finalHtml(
    renderProductsCreatePage(product, {
      banner,
      withAcademyIntegration: Boolean(academyIntegration),
      academyAccountSubdomains: academyAccountSubdomains ?? [],
      academyCoursesBySubdomain,
      withSmooveIntegration: Boolean(smooveIntegration),
      withRavmesserIntegration: Boolean(ravmesserIntegration),
      withSkoolIntegration: Boolean(skoolIntegration),
    }),
  )
}

export async function showProductUpdate(
  productNumber: number,
  productWithError: {product: Product | undefined; error: any; operation: string} | undefined,
  sql: Sql,
  appBaseUrl: string,
): Promise<ControllerResult> {
  const academyIntegration = requestContext.get('academyIntegration')
  const academyAccountSubdomains = requestContext.get('academyAccountSubdomains')
  const whatsappIntegration = requestContext.get('whatsappIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const ravmesserIntegration = requestContext.get('ravmesserIntegration')
  const skoolIntegration = requestContext.get('skoolIntegration')
  const nowService = requestContext.get('nowService')!
  const now = nowService()

  const [whatsappGroups, smooveLists, ravmesserLists, productWithHistory] = await Promise.all([
    listWhatsAppGroups(whatsappIntegration, now),
    when(smooveIntegration, (smooveIntegration) => listSmooveLists(smooveIntegration, now)),
    when(ravmesserIntegration, (ravmesserIntegration) =>
      listRavmesserLists(ravmesserIntegration, now),
    ),
    queryProductByNumber(productNumber, sql),
  ])
  requestContext.set('whatsappGroups', whatsappGroups)
  requestContext.set('smooveLists', smooveLists)
  requestContext.set('ravmesserLists', ravmesserLists)

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

  const academyCoursesBySubdomain = await listCoursesForSubdomains(
    academyIntegration,
    getSubdomainsFromProduct(productWithHistory.product, {alsoIncludeFirstSubdomain: true}),
    now,
  )

  return finalHtml(
    renderProductUpdatePage(productWithHistory.product, productWithHistory.history, {
      banner,
      withAcademyIntegration: Boolean(academyIntegration),
      academyAccountSubdomains: academyAccountSubdomains ?? [],
      academyCoursesBySubdomain,
      withSmooveIntegration: Boolean(smooveIntegration),
      withRavmesserIntegration: Boolean(ravmesserIntegration),
      withSkoolIntegration: Boolean(skoolIntegration),
      appBaseUrl,
    }),
  )
}

export async function showOngoingProduct(
  product: OngoingProduct,
  {manipulations}: {manipulations: ProductManipulations},
): Promise<ControllerResult> {
  const academyIntegration = requestContext.get('academyIntegration')
  const academyAccountSubdomains = requestContext.get('academyAccountSubdomains')
  const whatsappIntegration = requestContext.get('whatsappIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const ravmesserIntegration = requestContext.get('ravmesserIntegration')
  const skoolIntegration = requestContext.get('skoolIntegration')
  const nowService = requestContext.get('nowService')!
  const now = nowService()

  const [whatsappGroups, smooveLists, ravmesserLists] = await Promise.all([
    listWhatsAppGroups(whatsappIntegration, now),
    when(smooveIntegration, (smooveIntegration) => listSmooveLists(smooveIntegration, now)),
    when(ravmesserIntegration, (ravmesserIntegration) =>
      listRavmesserLists(ravmesserIntegration, now),
    ),
  ])
  const academyCoursesBySubdomain = await listCoursesForSubdomains(
    academyIntegration,
    getSubdomainsFromProduct(product, {alsoIncludeFirstSubdomain: true}),
    now,
  )
  requestContext.set('whatsappGroups', whatsappGroups)
  requestContext.set('smooveLists', smooveLists)
  requestContext.set('ravmesserLists', ravmesserLists)

  return finalHtml(
    renderProductFormFields(product, manipulations, 'write', {
      withAcademyIntegration: Boolean(academyIntegration),
      academyAccountSubdomains: academyAccountSubdomains ?? [],
      academyCoursesBySubdomain,
      withSmooveIntegration: Boolean(smooveIntegration),
      withRavmesserIntegration: Boolean(ravmesserIntegration),
      withSkoolIntegration: Boolean(skoolIntegration),
    }),
  )
}

export async function showProductInHistory(
  productNumber: number,
  operationId: string,
  sql: Sql,
): Promise<ControllerResult> {
  const academyIntegration = requestContext.get('academyIntegration')
  const academyAccountSubdomains = requestContext.get('academyAccountSubdomains')
  const whatsappIntegration = requestContext.get('whatsappIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const ravmesserIntegration = requestContext.get('ravmesserIntegration')
  const skoolIntegration = requestContext.get('skoolIntegration')
  const nowService = requestContext.get('nowService')!
  const now = nowService()

  const [whatsappGroups, smooveLists, ravmesserLists, product] = await Promise.all([
    listWhatsAppGroups(whatsappIntegration, now),
    when(smooveIntegration, (smooveIntegration) => listSmooveLists(smooveIntegration, now)),
    when(ravmesserIntegration, (ravmesserIntegration) =>
      listRavmesserLists(ravmesserIntegration, now),
    ),
    queryProductByHistoryId(productNumber, operationId, sql),
  ])
  requestContext.set('whatsappGroups', whatsappGroups)
  requestContext.set('smooveLists', smooveLists)
  requestContext.set('ravmesserLists', ravmesserLists)

  if (!product) {
    return {status: 404, body: 'Product not found'}
  }

  const academyCoursesBySubdomain = await listCoursesForSubdomains(
    academyIntegration,
    getSubdomainsFromProduct(product.product, {alsoIncludeFirstSubdomain: false}),
    now,
  )

  return finalHtml(
    renderProductViewInHistoryPage(product.product, product.history, {
      withAcademyIntegration: Boolean(academyIntegration),
      academyAccountSubdomains: academyAccountSubdomains ?? [],
      academyCoursesBySubdomain,
      withSmooveIntegration: Boolean(smooveIntegration),
      withRavmesserIntegration: Boolean(ravmesserIntegration),
      withSkoolIntegration: Boolean(skoolIntegration),
    }),
  )
}

export async function createProduct(product: NewProduct, sql: Sql): Promise<ControllerResult> {
  try {
    const nowService = requestContext.get('nowService')!
    const whatsappIntegration = requestContext.get('whatsappIntegration')!
    const smooveIntegration = requestContext.get('smooveIntegration')
    const ravmesserIntegration = requestContext.get('ravmesserIntegration')
    const academyIntegration = requestContext.get('academyIntegration')

    const [smooveLists, ravmesserLists, whatsappGroups] = await Promise.all([
      when(smooveIntegration, (smooveIntegration) =>
        listSmooveLists(smooveIntegration, nowService()),
      ),
      when(ravmesserIntegration, (ravmesserIntegration) =>
        listRavmesserLists(ravmesserIntegration, nowService()),
      ),
      listWhatsAppGroups(whatsappIntegration, nowService()),
    ])

    const academyCoursesBySubdomain = await when(academyIntegration, (academyIntegration) =>
      listCoursesForSubdomains(
        academyIntegration,
        getSubdomainsFromProduct(product, {alsoIncludeFirstSubdomain: true}),
        nowService(),
      ),
    )

    if (
      !isValidProduct(product, {
        smooveLists,
        ravmesserLists,
        whatsappGroups,
        academyCoursesBySubdomain,
      })
    ) {
      return await showProductCreate(product, {error: undefined})
    }
    const productNumber = await model_createProduct(product, undefined, nowService(), sql)

    return {htmxRedirect: `/products/${productNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, 'create-product')

    return showProductCreate(product, {error})
  }
}

export async function updateProduct(
  product: Product,
  sql: Sql,
  appBaseUrl: string,
): Promise<ControllerResult> {
  try {
    const nowService = requestContext.get('nowService')!
    const whatsappIntegration = requestContext.get('whatsappIntegration')!
    const smooveIntegration = requestContext.get('smooveIntegration')
    const ravmesserIntegration = requestContext.get('ravmesserIntegration')
    const academyIntegration = requestContext.get('academyIntegration')

    const [smooveLists, ravmesserLists, whatsappGroups] = await Promise.all([
      when(smooveIntegration, (smooveIntegration) =>
        listSmooveLists(smooveIntegration, nowService()),
      ),
      when(ravmesserIntegration, (ravmesserIntegration) =>
        listRavmesserLists(ravmesserIntegration, nowService()),
      ),
      listWhatsAppGroups(whatsappIntegration, nowService()),
    ])

    const academyCoursesBySubdomain = await when(academyIntegration, (academyIntegration) =>
      listCoursesForSubdomains(
        academyIntegration,
        getSubdomainsFromProduct(product, {alsoIncludeFirstSubdomain: true}),
        nowService(),
      ),
    )

    if (
      !isValidProduct(product, {
        smooveLists,
        ravmesserLists,
        whatsappGroups,
        academyCoursesBySubdomain,
      })
    ) {
      return showOngoingProduct(product, {manipulations: {addItem: undefined}})
    }
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
    return showProductUpdate(
      product.productNumber,
      {product, error, operation: 'Updating'},
      sql,
      appBaseUrl,
    )
  }
}

export async function deleteProduct(
  productNumber: number,
  deleteOperation: 'delete' | 'restore',
  sql: Sql,
  appBaseUrl: string,
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
      await showProductUpdate(
        productNumber,
        {product: undefined, error, operation},
        sql,
        appBaseUrl,
      ),
      'body',
    )
  }
}

export async function showProductDatalist(q: string | undefined): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!

  const products = q ? await searchProducts(q, sql) : []

  return finalHtml(renderProductListOptions(products))
}
