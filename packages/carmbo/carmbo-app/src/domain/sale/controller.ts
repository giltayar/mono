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
  querySalePayments,
  findSalesEventAndStudentByEmail as findSaleAndStudentAndProductByEmail,
} from './model/model.ts'
import {handleCardcomSale, connectSale as model_connectSale} from './model/model-sale.ts'
import {
  handleCardcomRecurringPayment,
  cancelSubscription as model_cancelSubscription,
} from './model/model-standing-order.ts'
import {finalHtml, retarget, type ControllerResult} from '../../commons/controller-result.ts'
import {renderSalesPage} from './view/list.ts'
import {
  renderSaleCreatePage,
  renderSaleFormFields,
  renderSalePaymentsPage,
  renderSaleViewPage,
} from './view/view.ts'
import type {Sql} from 'postgres'
import {
  renderSalesEventListPage,
  renderStudentListPage,
  renderProductListPage,
} from './view/list-searches.ts'
import {exceptionToBanner, exceptionToBannerHtml} from '../../layout/banner.ts'
import type {
  CardcomRecurringOrderWebHookJson,
  CardcomSaleWebhookJson,
} from '@giltayar/carmel-tools-cardcom-integration/types'
import {
  showErrorCancellingSubscription,
  showErrorSubscriptionNotFound,
  showSubscriptionCancelled,
} from './view/cancel-subscription.ts'

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
    const nowService = requestContext.get('nowService')!
    const saleNumber = await model_createSale(sale, undefined, nowService(), sql)

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
  const nowService = requestContext.get('nowService')!
  const now = nowService()
  const sql = requestContext.get('sql')!
  const smooveIntegration = requestContext.get('smooveIntegration')!
  const cardcomIntegration = requestContext.get('cardcomIntegration')!
  const logger = requestContext.get('logger')!

  await handleCardcomSale(
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

export async function dealWithCardcomRecurringPayment(
  cardcomSaleWebhookJson: CardcomRecurringOrderWebHookJson,
): Promise<ControllerResult> {
  const nowService = requestContext.get('nowService')!
  const sql = requestContext.get('sql')!
  const now = nowService()
  const cardcomIntegration = requestContext.get('cardcomIntegration')!
  const logger = requestContext.get('logger')!

  await handleCardcomRecurringPayment(cardcomSaleWebhookJson, now, sql, cardcomIntegration, logger)

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

export async function showSale(
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

export async function showSalePayments(saleNumber: number, sql: Sql): Promise<ControllerResult> {
  const saleWithPayments = await querySalePayments(saleNumber, sql)

  if (!saleWithPayments) {
    return {status: 404, body: 'Sale not found'}
  }
  return finalHtml(renderSalePaymentsPage(saleWithPayments))
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
  const logger = requestContext.get('logger')!
  try {
    const nowService = requestContext.get('nowService')!
    const saleNumber = await model_updateSale(sale, undefined, nowService(), sql)

    if (!saleNumber) {
      return {status: 404, body: 'Sale not found'}
    }

    return {htmxRedirect: `/sales/${saleNumber}`}
  } catch (error) {
    logger.error({err: error}, 'update-sale')
    return showSale(sale.saleNumber, {sale, error, operation: 'Updating'}, sql)
  }
}

export async function deleteSale(
  saleNumber: number,
  deleteOperation: 'delete' | 'restore',
  sql: Sql,
): Promise<ControllerResult> {
  try {
    const nowService = requestContext.get('nowService')!
    const operationId = await model_deleteSale(
      saleNumber,
      undefined,
      deleteOperation,
      nowService(),
      sql,
    )

    if (!operationId) {
      return {status: 404, body: 'Sale not found'}
    }

    return {htmxRedirect: `/sales/${saleNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, 'delete-sale')
    return retarget(
      await showSale(
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
    const nowService = requestContext.get('nowService')!
    const logger = requestContext.get('logger')!
    const now = nowService()

    await model_updateSale(sale, undefined, now, sql)

    await model_connectSale(
      saleNumber,
      now,
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

export async function cancelSubscription(
  email: string,
  salesEventNumber: number,
): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!
  const cardcomIntegration = requestContext.get('cardcomIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')!
  const academyIntegration = requestContext.get('academyIntegration')!
  const nowService = requestContext.get('nowService')!
  const logger = requestContext.get('logger')!
  const now = nowService()

  try {
    const {studentName, productName, saleNumber} = await findSaleAndStudentAndProductByEmail(
      email,
      salesEventNumber,
      sql,
    )

    if (studentName === undefined || productName === undefined || saleNumber === undefined) {
      return finalHtml(
        showErrorSubscriptionNotFound({email, salesEventNumber, studentName, productName}),
      )
    }

    await model_cancelSubscription(
      email,
      saleNumber,
      sql,
      cardcomIntegration,
      academyIntegration,
      smooveIntegration,
      now,
      logger,
    )

    return finalHtml(showSubscriptionCancelled(email, studentName, productName))
  } catch (err) {
    const logger = requestContext.get('logger')!
    logger.error({err}, 'cancel-subscription')

    return finalHtml(showErrorCancellingSubscription(email, salesEventNumber))
  }
}
