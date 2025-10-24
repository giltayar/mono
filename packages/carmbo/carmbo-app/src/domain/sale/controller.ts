import {requestContext} from '@fastify/request-context'
import {
  listSales,
  querySaleByNumber,
  querySaleByHistoryId,
  searchSalesEvents,
  searchStudents,
  searchProducts,
  createSale as model_createSale,
  updateSale as model_updateSale,
  deleteSale as model_deleteSale,
  type NewSale,
  type Sale,
  fillInSale,
} from './model.ts'
import {connectSale as model_connectSale} from './model-sale.ts'
import {handleCardcomOneTimeSale} from './model-sale.ts'
import {finalHtml, retarget, type ControllerResult} from '../../commons/controller-result.ts'
import {renderSalesPage} from './view/list.ts'
import {renderSaleCreatePage, renderSaleFormFields, renderSaleViewPage} from './view/view.ts'
import type {Sql} from 'postgres'
import {
  renderSalesEventListPage,
  renderStudentListPage,
  renderProductListPage,
} from './view/list-searches.ts'
import {exceptionToBanner, exceptionToBannerHtml} from '../../layout/banner.ts'
import type {CardcomSaleWebhookJson} from '@giltayar/carmel-tools-cardcom-integration/types'

export async function showSaleCreate(
  sale: NewSale | undefined,
  {error}: {error?: any} = {},
): Promise<ControllerResult> {
  const banner = exceptionToBanner('Creating sale error: ', error)

  return finalHtml(renderSaleCreatePage(sale, {banner}))
}

export async function showOngoingSale(sale: NewSale): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!

  return finalHtml(renderSaleFormFields(sale ? await fillInSale(sale, sql) : undefined))
}

export async function showSalesEventList(q: string | undefined): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!

  const salesEvents = q ? await searchSalesEvents(q, sql) : []

  return finalHtml(renderSalesEventListPage(salesEvents))
}

export async function showStudentList(q: string | undefined): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!

  const students = q ? await searchStudents(q, sql) : []

  return finalHtml(renderStudentListPage(students))
}

export async function showProductList(q: string | undefined): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!

  const products = q ? await searchProducts(q, sql) : []

  return finalHtml(renderProductListPage(products))
}

export async function createSale(sale: NewSale, sql: Sql): Promise<ControllerResult> {
  try {
    const saleNumber = await model_createSale(sale, undefined, sql)

    return {htmxRedirect: `/sales/${saleNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, 'create-sale')
    return showSaleCreate(sale, {error})
  }
}

export async function dealWithCardcomOneTimeSale(
  cardcomSaleWebhookJson: CardcomSaleWebhookJson,
  salesEventNumber: number,
): Promise<ControllerResult> {
  const now = new Date()
  const sql = requestContext.get('sql')!
  const smooveIntegration = requestContext.get('smooveIntegration')!
  const cardcomIntegration = requestContext.get('cardcomIntegration')!
  const logger = requestContext.get('logger')!

  await handleCardcomOneTimeSale(
    salesEventNumber,
    cardcomSaleWebhookJson,
    now,
    smooveIntegration,
    cardcomIntegration,
    sql,
    logger,
  )

  return 'ok'
}

export async function showSales(
  {
    flash,
    withArchived,
    query,
    page,
  }: {flash?: string; withArchived: boolean; query: string | undefined; page: number},
  sql: Sql,
): Promise<ControllerResult> {
  const sales = await listSales(sql, {withArchived, query: query ?? '', limit: 50, page})

  return finalHtml(renderSalesPage(flash, sales, {withArchived, query: query ?? '', page}))
}

export async function showSale(saleNumber: number, sql: Sql): Promise<ControllerResult> {
  const saleWithHistory = await querySaleByNumber(saleNumber, sql)

  if (!saleWithHistory) {
    return {status: 404, body: 'Sale not found'}
  }

  return finalHtml(renderSaleViewPage(saleWithHistory.sale, saleWithHistory.history))
}

export async function showSaleUpdate(
  saleNumber: number,
  saleWithError: {sale: Sale | undefined; error: any; operation: string} | undefined,
  sql: Sql,
): Promise<ControllerResult> {
  const saleWithHistory = await querySaleByNumber(saleNumber, sql)

  if (!saleWithHistory) {
    return {status: 404, body: 'Sale not found'}
  }

  const banner = exceptionToBanner(`${saleWithError?.operation} sale error: `, saleWithError?.error)

  if (saleWithError?.sale) {
    saleWithHistory.sale = {
      ...saleWithHistory.sale,
      ...saleWithError.sale,
    }
  }

  return finalHtml(renderSaleViewPage(saleWithHistory.sale, saleWithHistory.history, {banner}))
}

export async function showSaleInHistory(
  saleNumber: number,
  operationId: string,
  sql: Sql,
): Promise<ControllerResult> {
  const saleWithHistory = await querySaleByHistoryId(saleNumber, operationId, sql)

  if (!saleWithHistory) {
    return {status: 404, body: 'Sale not found'}
  }

  return finalHtml(renderSaleViewPage(saleWithHistory.sale, saleWithHistory.history))
}

export async function updateSale(sale: Sale, sql: Sql): Promise<ControllerResult> {
  try {
    const saleNumber = await model_updateSale(sale, undefined, sql)

    if (!saleNumber) {
      return {status: 404, body: 'Sale not found'}
    }

    return {htmxRedirect: `/sales/${saleNumber}`}
  } catch (error) {
    return showSaleUpdate(sale.saleNumber, {sale, error, operation: 'Updating'}, sql)
  }
}

export async function deleteSale(
  saleNumber: number,
  deleteOperation: 'delete' | 'restore',
  sql: Sql,
): Promise<ControllerResult> {
  try {
    const operationId = await model_deleteSale(saleNumber, undefined, deleteOperation, sql)

    if (!operationId) {
      return {status: 404, body: 'Sale not found'}
    }

    return {htmxRedirect: `/sales/${saleNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, 'delete-sale')
    return retarget(
      await showSaleUpdate(
        saleNumber,
        {
          sale: undefined,
          error,
          operation: deleteOperation === 'delete' ? 'Archiving' : 'Restoring',
        },
        sql,
      ),
      'body',
    )
  }
}

export async function connectSale(saleNumber: number, sale: Sale): Promise<ControllerResult> {
  try {
    const sql = requestContext.get('sql')!
    const cardcomIntegration = requestContext.get('cardcomIntegration')!
    const smooveIntegration = requestContext.get('smooveIntegration')!
    const academyIntegration = requestContext.get('academyIntegration')!
    const logger = requestContext.get('logger')!

    await model_updateSale(sale, undefined, sql)

    await model_connectSale(
      saleNumber,
      new Date(),
      sql,
      cardcomIntegration,
      smooveIntegration,
      academyIntegration,
      logger,
    )

    return {htmxRedirect: `/sales/${saleNumber}`}
  } catch (err) {
    const logger = requestContext.get('logger')!
    logger.error({err}, 'connect-manual-sale')

    return retarget(exceptionToBannerHtml('Error connecting sale: ', err), '#banner-container')
  }
}
