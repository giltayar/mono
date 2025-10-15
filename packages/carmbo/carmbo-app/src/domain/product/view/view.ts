import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import type {NewProduct, Product, ProductHistory, ProductWithHistoryInfo} from '../model.ts'
import type {OngoingProduct} from './model.ts'
import {manipulateProduct, type ProductManipulations} from './product-manipulations.ts'
import {ProductCreateOrUpdateFormFields} from './form.ts'
import {ProductCreateView, ProductHistoryView, ProductUpdateView} from './create-update.ts'
import {Layout} from './layout.ts'
import type {Banner} from '../../../layout/banner.ts'

export function renderProductsCreatePage(
  product: OngoingProduct | undefined,
  {banner}: {banner?: Banner | undefined} = {},
) {
  const finalProduct: OngoingProduct = product
    ? product
    : {
        name: '',
        productType: 'recorded',
        academyCourses: [],
        whatsappGroups: [],
        facebookGroups: [],
        smooveListId: undefined,
        smooveCancellingListId: undefined,
        smooveCancelledListId: undefined,
        smooveRemovedListId: undefined,
      }

  return html`
    <${MainLayout} title="Products" activeNavItem="products" banner=${banner}>
      <${Layout}>
        <${ProductCreateView} product=${finalProduct} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderProductUpdatePage(
  product: ProductWithHistoryInfo,
  history: ProductHistory[],
  {banner}: {banner?: Banner | undefined} = {},
) {
  return html`
    <${MainLayout} title="Products" activeNavItem="products" banner=${banner}>
      <${Layout}>
        <${ProductUpdateView} product=${product} history=${history} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderProductViewInHistoryPage(
  product: ProductWithHistoryInfo,
  history: ProductHistory[],
) {
  return html`
    <${MainLayout} title="Products" activeNavItem="products">
      <${Layout}>
        <${ProductHistoryView} product=${product} history=${history} operationId=${product.id} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderProductFormFields(
  product: Product | OngoingProduct | NewProduct,
  manipulations: ProductManipulations,
  operation: 'read' | 'write',
) {
  return html`
    <${ProductCreateOrUpdateFormFields}
      product=${manipulateProduct(product, manipulations)}
      operation=${operation}
    />
  `
}
