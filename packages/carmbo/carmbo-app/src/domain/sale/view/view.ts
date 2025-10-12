import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import type {SaleHistory, SaleWithHistoryInfo} from '../model.ts'
import {SaleView} from './sale.ts'
import {Layout} from './layout.ts'

export function renderSaleViewPage(sale: SaleWithHistoryInfo, history: SaleHistory[]) {
  return html`
    <${MainLayout} title="Sales" activeNavItem="sales">
      <${Layout}>
        <${SaleView} sale=${sale} history=${history} />
      </${Layout}>
    </${MainLayout}>
  `
}
