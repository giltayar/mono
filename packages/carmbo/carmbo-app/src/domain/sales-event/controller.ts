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
} from './model.ts'
import {
  renderSalesEventsCreatePage,
  renderSalesEventFormFields,
  renderSalesEventUpdatePage,
  renderSalesEventViewInHistoryPage,
} from './view/view.ts'
import {renderSalesEventsPage} from './view/list.ts'
import {finalHtml, type ControllerResult} from '../../commons/controller-result.ts'
import type {SalesEventManipulations} from './view/sales-event-manipulations.ts'

export async function showSalesEvents(
  {
    flash,
    withArchived,
    query,
    page,
  }: {flash?: string; withArchived: boolean; query: string | undefined; page: number},
  sql: Sql,
): Promise<ControllerResult> {
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

export async function showSalesEventCreate(): Promise<ControllerResult> {
  return finalHtml(renderSalesEventsCreatePage(undefined, undefined))
}

export async function showSalesEventUpdate(
  salesEventNumber: number,
  manipulations: SalesEventManipulations,
  sql: Sql,
): Promise<ControllerResult> {
  const salesEventWithHistory = await querySalesEventByNumber(salesEventNumber, sql)

  if (!salesEventWithHistory) {
    return {status: 404, body: 'Sales event not found'}
  }
  return finalHtml(
    renderSalesEventUpdatePage(
      salesEventWithHistory.salesEvent,
      salesEventWithHistory.history,
      manipulations,
    ),
  )
}

export async function showOngoingSalesEvent(
  salesEvent: OngoingSalesEvent,
  manipulations: SalesEventManipulations,
): Promise<ControllerResult> {
  return finalHtml(renderSalesEventFormFields(salesEvent, manipulations, 'write'))
}

export async function showSalesEventInHistory(
  salesEventNumber: number,
  operationId: string,
  sql: Sql,
): Promise<ControllerResult> {
  const salesEvent = await querySalesEventByHistoryId(salesEventNumber, operationId, sql)

  if (!salesEvent) {
    return {status: 404, body: 'Sales event not found'}
  }

  return finalHtml(renderSalesEventViewInHistoryPage(salesEvent.salesEvent, salesEvent.history))
}

export async function createSalesEvent(
  salesEvent: NewSalesEvent,
  sql: Sql,
): Promise<ControllerResult> {
  const salesEventNumber = await model_createSalesEvent(salesEvent, undefined, sql)

  return {htmxRedirect: `/sales-events/${salesEventNumber}`}
}

export async function updateSalesEvent(
  salesEvent: SalesEvent,
  sql: Sql,
): Promise<ControllerResult> {
  const salesEventNumber = await model_updateSalesEvent(salesEvent, undefined, sql)

  if (!salesEventNumber) {
    return {status: 404, body: 'Sales event not found'}
  }

  return {htmxRedirect: `/sales-events/${salesEventNumber}`}
}

export async function deleteSalesEvent(
  salesEventNumber: number,
  deleteOperation: 'delete' | 'restore',
  sql: Sql,
): Promise<ControllerResult> {
  const operationId = await model_deleteSalesEvent(
    salesEventNumber,
    undefined,
    deleteOperation,
    sql,
  )

  if (!operationId) {
    return {status: 404, body: 'Sales event not found'}
  }

  return {htmxRedirect: `/sales-events/${salesEventNumber}`}
}
