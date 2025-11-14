import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {
  type NewSale,
  type SaleHistory,
  type SaleWithHistoryInfo,
  type SaleWithPayments,
} from '../model/model.ts'
import {SaleUpdateView} from './sale.ts'
import {Layout} from './layout.ts'
import {SaleCreateView} from './create-update.ts'
import {SalesFormFields} from './form.ts'
import type {Banner} from '../../../layout/banner.ts'
import {SalePaymentsView} from './sale-payment.ts'

export function renderSaleCreatePage(sale: NewSale | undefined, {banner}: {banner?: Banner} = {}) {
  const finalSale: NewSale = sale ?? {
    salesEventNumber: 0,
    salesEventName: '',
    studentNumber: 0,
    studentName: '',
    finalSaleRevenue: undefined,
    products: [],
    cardcomInvoiceNumber: undefined,
    manualSaleType: 'manual',
  }

  return html`
    <${MainLayout} title="Sales" activeNavItem="sales" banner=${banner}>
      <${Layout}>
        <${SaleCreateView} sale=${finalSale} />
      </${Layout}>
    </${MainLayout}>
  `
}
export function renderSaleFormFields(sale: NewSale | undefined) {
  const finalSale: NewSale = sale ?? {
    salesEventNumber: 0,
    salesEventName: '',
    studentNumber: 0,
    studentName: '',
    finalSaleRevenue: undefined,
    products: [],
    cardcomInvoiceNumber: undefined,
    manualSaleType: 'manual',
  }

  return html`<${SalesFormFields} sale=${finalSale} operation="write" saleNumber=${undefined} />`
}

export function renderSaleViewPage(
  sale: SaleWithHistoryInfo,
  history: SaleHistory[],
  {banner}: {banner?: Banner} = {},
) {
  return html`
    <${MainLayout} title="Sales" activeNavItem="sales" banner=${banner}>
      <${Layout}>
        <${SaleUpdateView} sale=${sale} history=${history} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderSalePaymentsPage(sale: SaleWithPayments) {
  return html`
    <${MainLayout} title="Sale Payments" activeNavItem="sales">
      <${Layout}>
        <${SalePaymentsView} sale=${sale} />
      </${Layout}>
    </${MainLayout}>
  `
}
