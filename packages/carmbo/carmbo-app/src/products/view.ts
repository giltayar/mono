import {html} from '../commons/html-templates.ts'
import {MainLayout} from '../layouts/main-view.ts'
import type {NewProduct, Product, ProductHistory, ProductWithHistoryInfo} from './model.ts'
import {manipulateProduct, type ProductManipulations} from './view-product-manipulations.ts'
import {ProductCreateOrUpdateFormFields} from './view-form.ts'
import {ProductCreateView, ProductHistoryView, ProductUpdateView} from './view-create-update.ts'
import {Layout} from './layout.ts'

export function renderProductsCreatePage(
  product: NewProduct | undefined,
  manipulations: ProductManipulations | undefined,
) {
  const finalProduct: NewProduct = product
    ? manipulations
      ? manipulateProduct(product, manipulations)
      : product
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
        cardcomProductId: undefined,
      }

  return html`
    <${MainLayout} title="Products" activeNavItem="products">
      <${Layout}>
        <${ProductCreateView} product=${finalProduct} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderProductUpdatePage(
  product: ProductWithHistoryInfo,
  history: ProductHistory[],
  manipulations: ProductManipulations,
) {
  return html`
    <${MainLayout} title="Products" activeNavItem="products">
      <${Layout}>
        <${ProductUpdateView} product=${manipulateProduct(product, manipulations)} history=${history} />
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
  product: Product | NewProduct,
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
