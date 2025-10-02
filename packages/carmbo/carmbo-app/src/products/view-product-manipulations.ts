import assert from 'node:assert'
import type {NewProduct, Product} from './model.ts'

export type ProductManipulations = {
  addItem: string | string[] | undefined
}

export function manipulateProduct<T extends NewProduct | Product>(
  product: T,
  manipulations: ProductManipulations,
): T {
  const transformed = {...product}
  const addItem = Array.isArray(manipulations.addItem) ? undefined : manipulations.addItem
  assert(
    addItem === undefined || ARRAY_FIELDS_IN_PRODUCT.includes(addItem),
    `Invalid addItem: ${addItem}`,
  )

  if (addItem) {
    // @ts-expect-error dynamic stuff!
    ;(transformed[addItem] ??= []).push('')
  }

  return transformed
}

const ARRAY_FIELDS_IN_PRODUCT = ['academyCourses', 'whatsappGroups', 'facebookGroups']
