import type {Sql} from 'postgres'

import type {NewSalesEvent, SalesEvent} from './model.ts'
import type {OngoingSalesEvent} from './view/model.ts'
import {
  listSalesEvents,
  querySalesEventByNumber,
  querySalesEventByHistoryId,
  createSalesEvent as model_createSalesEvent,
  updateSalesEvent as model_updateSalesEvent,
  deleteSalesEvent as model_deleteSalesEvent,
  listProductsForChoosing as model_listProductsForChoosing,
} from './model.ts'
import {
  renderSalesEventsCreatePage,
  renderSalesEventFormFields,
  renderSalesEventUpdatePage,
  renderSalesEventViewInHistoryPage,
} from './view/view.ts'
import {renderSalesEventsPage} from './view/list.ts'
import {finalHtml, retarget, type ControllerResult} from '../../commons/controller-result.ts'
import type {SalesEventManipulations} from './view/sales-event-manipulations.ts'
import {requestContext} from '@fastify/request-context'
import {exceptionToBanner, type Banner} from '../../layout/banner.ts'

export async function showSalesEvents(
  {
    flash,
    withArchived,
    query,
    page,
  }: {flash?: string; withArchived: boolean; query: string | undefined; page: number},
  sql: Sql,
): Promise<ControllerResult> {
  const products = await listProductsForChoosing(sql)
  requestContext.set('products', products)

  const salesEvents = await listSalesEvents(sql, {
    withArchived,
    query: query ?? '',
    limit: 50,
    page,
  })

  return finalHtml(
    renderSalesEventsPage(flash, salesEvents, {withArchived, query: query ?? '', page}),
  )
}

export async function showSalesEventCreate(
  salesEvent: NewSalesEvent | undefined,
  {error}: {error?: any} = {},
  sql: Sql,
): Promise<ControllerResult> {
  const products = await listProductsForChoosing(sql)
  requestContext.set('products', products)

  const banner: Banner | undefined = error
    ? {
        message: `Creating sales event error: ${'message' in error ? error.message : 'Unknown error'}`,
        type: 'error',
        disappearing: false,
      }
    : undefined

  return finalHtml(renderSalesEventsCreatePage(salesEvent, {banner}))
}

export async function showSalesEventUpdate(
  salesEventNumber: number,
  salesEventWithError:
    | {salesEvent: SalesEvent | undefined; error: any; operation: string}
    | undefined,
  sql: Sql,
  options: {appBaseUrl: string; apiSecret: string | undefined},
): Promise<ControllerResult> {
  const [products, salesEventWithHistory] = await Promise.all([
    listProductsForChoosing(sql),
    querySalesEventByNumber(salesEventNumber, sql),
  ])
  requestContext.set('products', products)

  if (!salesEventWithHistory) {
    return {status: 404, body: 'Sales event not found'}
  }

  const banner = exceptionToBanner(
    `${salesEventWithError?.operation} sales event error: `,
    salesEventWithError?.error,
  )
  salesEventWithHistory.salesEvent = {
    ...salesEventWithHistory.salesEvent,
    ...salesEventWithError?.salesEvent,
  }

  return finalHtml(
    renderSalesEventUpdatePage(
      salesEventWithHistory.salesEvent,
      salesEventWithHistory.history,
      {banner},
      options,
    ),
  )
}

export async function showOngoingSalesEvent(
  salesEvent: OngoingSalesEvent,
  {manipulations}: {manipulations: SalesEventManipulations},
  sql: Sql,
): Promise<ControllerResult> {
  const products = await listProductsForChoosing(sql)
  requestContext.set('products', products)

  return finalHtml(renderSalesEventFormFields(salesEvent, manipulations, 'write'))
}

export async function showSalesEventInHistory(
  salesEventNumber: number,
  operationId: string,
  sql: Sql,
): Promise<ControllerResult> {
  const [products, salesEvent] = await Promise.all([
    listProductsForChoosing(sql),
    querySalesEventByHistoryId(salesEventNumber, operationId, sql),
  ])
  requestContext.set('products', products)

  if (!salesEvent) {
    return {status: 404, body: 'Sales event not found'}
  }

  return finalHtml(renderSalesEventViewInHistoryPage(salesEvent.salesEvent, salesEvent.history))
}

export async function createSalesEvent(
  salesEvent: NewSalesEvent,
  sql: Sql,
): Promise<ControllerResult> {
  try {
    const nowService = requestContext.get('nowService')!
    const salesEventNumber = await model_createSalesEvent(salesEvent, undefined, nowService(), sql)

    return {htmxRedirect: `/sales-events/${salesEventNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, 'create-sales-event')
    return showSalesEventCreate(salesEvent, {error}, sql)
  }
}

export async function deleteSalesEvent(
  salesEventNumber: number,
  deleteOperation: 'delete' | 'restore',
  sql: Sql,
  options: {appBaseUrl: string; apiSecret: string | undefined},
): Promise<ControllerResult> {
  try {
    const nowService = requestContext.get('nowService')!
    const operationId = await model_deleteSalesEvent(
      salesEventNumber,
      undefined,
      deleteOperation,
      nowService(),
      sql,
    )

    if (!operationId) {
      return {status: 404, body: 'Sales event not found'}
    }

    return {htmxRedirect: `/sales-events/${salesEventNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, `${deleteOperation}-sales-event`)

    return retarget(
      await showSalesEventUpdate(
        salesEventNumber,
        {
          salesEvent: undefined,
          error,
          operation: deleteOperation === 'delete' ? 'Archiving' : 'Restoring',
        },
        sql,
        options,
      ),
      'body',
    )
  }
}

export async function updateSalesEvent(
  salesEvent: SalesEvent,
  sql: Sql,
  options: {appBaseUrl: string; apiSecret: string | undefined},
): Promise<ControllerResult> {
  try {
    const nowService = requestContext.get('nowService')!
    const salesEventNumber = await model_updateSalesEvent(salesEvent, undefined, nowService(), sql)

    if (!salesEventNumber) {
      return {status: 404, body: 'Sales event not found'}
    }

    return {htmxRedirect: `/sales-events/${salesEventNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, 'update-sales-event')
    return showSalesEventUpdate(
      salesEvent.salesEventNumber,
      {salesEvent, error, operation: 'Updating'},
      sql,
      options,
    )
  }
}

const cachedProductsForChoosing: {
  groups: {id: number; name: string}[] | undefined
  timestamp: number
} = {
  groups: undefined,
  timestamp: 0,
}

async function listProductsForChoosing(sql: Sql) {
  if (
    Date.now() - cachedProductsForChoosing.timestamp > 1 * 60 * 1000 ||
    !cachedProductsForChoosing.groups
  ) {
    cachedProductsForChoosing.groups = await model_listProductsForChoosing(sql)
    cachedProductsForChoosing.timestamp = Date.now()
  }

  return cachedProductsForChoosing.groups
}
