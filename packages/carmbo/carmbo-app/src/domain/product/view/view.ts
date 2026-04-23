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
    academyAccountSubdomains,
    academyCoursesBySubdomain,
    withSmooveIntegration,
    withSkoolIntegration,
  }: {
    banner: Banner | undefined
    withAcademyIntegration: boolean
    academyAccountSubdomains: string[]
    academyCoursesBySubdomain: Map<string, {id: number; name: string}[]> | undefined
    withSmooveIntegration: boolean
    withSkoolIntegration: boolean
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
        smooveCancelledListId: undefined,
        smooveRemovedListId: undefined,
      }

  return html`
    <${MainLayout} title=${t('list.products')} activeNavItem="products" banner=${banner}>
      <${Layout}>
        <${ProductCreateView} product=${finalProduct} withAcademyIntegration=${withAcademyIntegration} academyAccountSubdomains=${academyAccountSubdomains} academyCoursesBySubdomain=${academyCoursesBySubdomain} withSmooveIntegration=${withSmooveIntegration} withSkoolIntegration=${withSkoolIntegration} />
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
    academyAccountSubdomains,
    academyCoursesBySubdomain,
    withSmooveIntegration,
    withSkoolIntegration,
  }: {
    banner: Banner | undefined
    withAcademyIntegration: boolean
    academyAccountSubdomains: string[]
    academyCoursesBySubdomain: Map<string, {id: number; name: string}[]> | undefined
    withSmooveIntegration: boolean
    withSkoolIntegration: boolean
  },
) {
  return html`
    <${MainLayout} title=${t('list.products')} activeNavItem="products" banner=${banner}>
      <${Layout}>
        <${ProductUpdateView} product=${product} history=${history} withAcademyIntegration=${withAcademyIntegration} academyAccountSubdomains=${academyAccountSubdomains} academyCoursesBySubdomain=${academyCoursesBySubdomain} withSmooveIntegration=${withSmooveIntegration} withSkoolIntegration=${withSkoolIntegration} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderProductViewInHistoryPage(
  product: ProductWithHistoryInfo,
  history: ProductHistory[],
  {
    withAcademyIntegration,
    academyAccountSubdomains,
    academyCoursesBySubdomain,
    withSmooveIntegration,
    withSkoolIntegration,
  }: {
    withAcademyIntegration: boolean
    academyAccountSubdomains: string[]
    academyCoursesBySubdomain: Map<string, {id: number; name: string}[]> | undefined
    withSmooveIntegration: boolean
    withSkoolIntegration: boolean
  },
) {
  return html`
    <${MainLayout} title=${t('list.products')} activeNavItem="products">
      <${Layout}>
        <${ProductHistoryView} product=${product} history=${history} operationId=${product.id} withAcademyIntegration=${withAcademyIntegration} academyAccountSubdomains=${academyAccountSubdomains} academyCoursesBySubdomain=${academyCoursesBySubdomain} withSmooveIntegration=${withSmooveIntegration} withSkoolIntegration=${withSkoolIntegration} />
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
    academyAccountSubdomains,
    academyCoursesBySubdomain,
    withSmooveIntegration,
    withSkoolIntegration,
  }: {
    withAcademyIntegration: boolean
    academyAccountSubdomains: string[]
    academyCoursesBySubdomain: Map<string, {id: number; name: string}[]> | undefined
    withSmooveIntegration: boolean
    withSkoolIntegration: boolean
  },
) {
  return html`
    <${ProductCreateOrUpdateFormFields}
      product=${manipulateProduct(product, manipulations)}
      operation=${operation}
      withAcademyIntegration=${withAcademyIntegration}
      academyAccountSubdomains=${academyAccountSubdomains}
      academyCoursesBySubdomain=${academyCoursesBySubdomain}
      withSmooveIntegration=${withSmooveIntegration}
      withSkoolIntegration=${withSkoolIntegration}
    />
  `
}
