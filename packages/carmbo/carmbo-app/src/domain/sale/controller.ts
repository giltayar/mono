import {requestContext} from '@fastify/request-context'
import {
  handleCardcomOneTimeSale,
  type CardcomSaleWebhookJson,
  listSales,
  querySaleByNumber,
  querySaleByHistoryId,
} from './model.ts'
import {finalHtml, type ControllerResult} from '../../commons/controller-result.ts'
import {renderSalesPage} from './view/list.ts'
import {renderSaleViewPage, renderSaleViewInHistoryPage} from './view/view.ts'
import type {Sql} from 'postgres'

export async function dealWithCardcomOneTimeSale(
  cardcomSaleWebhookJson: CardcomSaleWebhookJson,
  salesEventNumber: number,
): Promise<ControllerResult> {
  const now = new Date()
  const sql = requestContext.get('sql')!
  const academyIntegration = requestContext.get('academyIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')!

  await handleCardcomOneTimeSale(
    salesEventNumber,
    cardcomSaleWebhookJson,
    now,
    academyIntegration,
    smooveIntegration,
    sql,
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

export async function showSaleInHistory(
  saleNumber: number,
  operationId: string,
  sql: Sql,
): Promise<ControllerResult> {
  const saleWithHistory = await querySaleByHistoryId(saleNumber, operationId, sql)

  if (!saleWithHistory) {
    return {status: 404, body: 'Sale not found'}
  }

  return finalHtml(renderSaleViewInHistoryPage(saleWithHistory.sale, saleWithHistory.history))
}
