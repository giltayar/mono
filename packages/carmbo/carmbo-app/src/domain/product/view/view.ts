import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import type {NewProduct, Product, ProductHistory, ProductWithHistoryInfo} from '../model.ts'
import type {OngoingProduct} from './model.ts'
import {manipulateProduct, type ProductManipulations} from './product-manipulations.ts'
import {ProductCreateOrUpdateFormFields} from './form.ts'
import {ProductCreateView, ProductHistoryView, ProductUpdateView} from './create-update.ts'
import {Layout} from './layout.ts'
import type {Banner} from '../../../layout/banner.ts'
import {getFixedT} from 'i18next'

const t = getFixedT(null, 'product')

export function renderProductsCreatePage(
  product: OngoingProduct | undefined,
  {
    banner,
    withAcademyIntegration,
    withSmooveIntegration,
  }: {
    banner: Banner | undefined
    withAcademyIntegration: boolean
    withSmooveIntegration: boolean
  },
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
    <${MainLayout} title=${t('list.products')} activeNavItem="products" banner=${banner}>
      <${Layout}>
        <${ProductCreateView} product=${finalProduct} withAcademyIntegration=${withAcademyIntegration} withSmooveIntegration=${withSmooveIntegration} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderProductUpdatePage(
  product: ProductWithHistoryInfo,
  history: ProductHistory[],
  {
    banner,
    withAcademyIntegration,
    withSmooveIntegration,
  }: {
    banner: Banner | undefined
    withAcademyIntegration: boolean
    withSmooveIntegration: boolean
  },
) {
  return html`
    <${MainLayout} title=${t('list.products')} activeNavItem="products" banner=${banner}>
      <${Layout}>
        <${ProductUpdateView} product=${product} history=${history} withAcademyIntegration=${withAcademyIntegration} withSmooveIntegration=${withSmooveIntegration} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderProductViewInHistoryPage(
  product: ProductWithHistoryInfo,
  history: ProductHistory[],
  {
    withAcademyIntegration,
    withSmooveIntegration,
  }: {withAcademyIntegration: boolean; withSmooveIntegration: boolean},
) {
  return html`
    <${MainLayout} title=${t('list.products')} activeNavItem="products">
      <${Layout}>
        <${ProductHistoryView} product=${product} history=${history} operationId=${product.id} withAcademyIntegration=${withAcademyIntegration} withSmooveIntegration=${withSmooveIntegration} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderProductFormFields(
  product: Product | OngoingProduct | NewProduct,
  manipulations: ProductManipulations,
  operation: 'read' | 'write',
  {
    withAcademyIntegration,
    withSmooveIntegration,
  }: {withAcademyIntegration: boolean; withSmooveIntegration: boolean},
) {
  return html`
    <${ProductCreateOrUpdateFormFields}
      product=${manipulateProduct(product, manipulations)}
      operation=${operation}
      withAcademyIntegration=${withAcademyIntegration}
      withSmooveIntegration=${withSmooveIntegration}
    />
  `
}
