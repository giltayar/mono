import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {fillInSale, type NewSale, type SaleHistory, type SaleWithHistoryInfo} from '../model.ts'
import {SaleUpdateView} from './sale.ts'
import {Layout} from './layout.ts'
import {SaleCreateView} from './create-update.ts'
import type {Sql} from 'postgres'
import {SalesFormFields} from './form.ts'
import type {Banner} from '../../../layout/banner.ts'

export async function renderSaleCreatePage(
  sale: NewSale | undefined,
  {banner}: {banner?: Banner} = {},
) {
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
export async function renderSaleFormFields(sale: NewSale | undefined, sql: Sql) {
  let finalSale: NewSale = sale ?? {
    salesEventNumber: 0,
    salesEventName: '',
    studentNumber: 0,
    studentName: '',
    finalSaleRevenue: undefined,
    products: [],
    cardcomInvoiceNumber: undefined,
    manualSaleType: 'manual',
  }

  if (sale) {
    finalSale = await fillInSale(finalSale, sql)
  }

  return html` <${SalesFormFields} sale=${finalSale} operation="write" />`
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
