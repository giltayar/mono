import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
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
import {SalesFormFields, StudentInput} from './form.ts'
import type {Banner} from '../../../layout/banner.ts'
import {SalePaymentsView} from './sale-payment.ts'
import type {SaleWithProviders} from '../model/model-external-providers.ts'
import {SaleProvidersView} from './sale-providers.ts'
import {
  renderStudentSearchDialog as renderStudentSearchDialogView,
  renderStudentSearchResults as renderStudentSearchResultsView,
} from './student-search-dialog.ts'

export function renderStudentSearchDialog() {
  return renderStudentSearchDialogView()
}

export function renderStudentSearchResults(
  students: {studentNumber: number; name: string; email: string | null; phone: string | null}[],
) {
  return renderStudentSearchResultsView(students)
}

export function renderStudentInput(studentNumber: number, studentName: string) {
  return StudentInput({studentNumber, studentName})
}

export function renderSaleCreatePage(sale: NewSale | undefined, {banner}: {banner?: Banner} = {}) {
  const t = getFixedT(null, 'sales')
  const finalSale: NewSale = sale ?? {
    salesEventNumber: 0,
    salesEventName: '',
    studentNumber: 0,
    studentName: '',
    finalSaleRevenue: undefined,
    products: [],
    cardcomInvoiceNumber: undefined,
    manualSaleType: 'manual',
    isActive: false,
    isConnected: false,
  }

  return html`
    <${MainLayout} title=${t('list.sales')} activeNavItem="sales" banner=${banner}>
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
    isActive: false,
    isConnected: false,
  }

  return html`<${SalesFormFields} sale=${finalSale} operation="write" saleNumber=${undefined} />`
}

export function renderSaleViewPage(
  sale: SaleWithHistoryInfo,
  history: SaleHistory[],
  {banner}: {banner?: Banner} = {},
) {
  const t = getFixedT(null, 'sales')
  return html`
    <${MainLayout} title=${t('list.sales')} activeNavItem="sales" banner=${banner}>
      <${Layout}>
        <${SaleUpdateView} sale=${sale} history=${history} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderSalePaymentsPage(sale: SaleWithPayments) {
  const t = getFixedT(null, 'sales')
  return html`
    <${MainLayout} title=${t('payments.salePayments', {saleNumber: sale.saleNumber})} activeNavItem="sales">
      <${Layout}>
        <${SalePaymentsView} sale=${sale} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderSaleProvidersPage(sale: SaleWithProviders) {
  const t = getFixedT(null, 'sales')
  return html`
    <${MainLayout} title=${t('providers.saleProviders', {saleNumber: sale.saleNumber})} activeNavItem="sales">
      <${Layout}>
        <${SaleProvidersView} sale=${sale} />
      </${Layout}>
    </${MainLayout}>
  `
}
