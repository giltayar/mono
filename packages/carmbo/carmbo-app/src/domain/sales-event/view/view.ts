import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import type {
  NewSalesEvent,
  SalesEvent,
  SalesEventHistory,
  SalesEventWithHistoryInfo,
} from '../model.ts'
import type {OngoingSalesEvent} from './model.ts'
import {manipulateSalesEvent, type SalesEventManipulations} from './sales-event-manipulations.ts'
import {SalesEventCreateOrUpdateFormFields} from './form.ts'
import {SalesEventCreateView, SalesEventHistoryView, SalesEventUpdateView} from './create-update.ts'
import {Layout} from './layout.ts'
import type {Banner} from '../../../layout/banner.ts'

export function renderSalesEventsCreatePage(
  salesEvent: NewSalesEvent | OngoingSalesEvent | undefined,
  {banner}: {banner?: Banner} = {},
) {
  const finalSalesEvent: OngoingSalesEvent = salesEvent
    ? salesEvent
    : {
        name: '',
        fromDate: undefined,
        toDate: undefined,
        landingPageUrl: undefined,
        productsForSale: [],
      }

  return html`
    <${MainLayout} title="Sales Events" activeNavItem="sales-events" banner=${banner}>
      <${Layout}>
        <${SalesEventCreateView} salesEvent=${finalSalesEvent} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderSalesEventUpdatePage(
  salesEvent: SalesEventWithHistoryInfo,
  history: SalesEventHistory[],
  {banner}: {banner?: Banner | undefined} = {},
  options: {appBaseUrl: string; apiSecret: string | undefined},
) {
  return html`
    <${MainLayout} title="Sales Events" activeNavItem="sales-events" banner=${banner}>
      <${Layout}>
        <${SalesEventUpdateView}
          salesEvent=${salesEvent}
          history=${history}
          options=${options}
        />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderSalesEventViewInHistoryPage(
  salesEvent: SalesEventWithHistoryInfo,
  history: SalesEventHistory[],
) {
  return html`
    <${MainLayout} title="Sales Events" activeNavItem="sales-events">
      <${Layout}>
        <${SalesEventHistoryView}
          salesEvent=${salesEvent}
          history=${history}
          operationId=${salesEvent.id}
        />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderSalesEventFormFields(
  salesEvent: SalesEvent | OngoingSalesEvent,
  manipulations: SalesEventManipulations,
  operation: 'read' | 'write',
) {
  return html`
    <${SalesEventCreateOrUpdateFormFields}
      salesEvent=${manipulateSalesEvent(salesEvent, manipulations)}
      operation=${operation}
    />
  `
}
