import assert from 'node:assert'
import type {OngoingSalesEvent} from './model.ts'
import type {SalesEvent} from '../model.ts'

export type SalesEventManipulations = {
  addItem: string | string[] | undefined
}

export function manipulateSalesEvent<T extends OngoingSalesEvent | SalesEvent>(
  salesEvent: T,
  manipulations: SalesEventManipulations,
): T {
  const transformed = {...salesEvent}
  const addItem = Array.isArray(manipulations.addItem) ? undefined : manipulations.addItem
  assert(
    addItem === undefined || ARRAY_FIELDS_IN_SALES_EVENT.includes(addItem),
    `Invalid addItem: ${addItem}`,
  )

  if (addItem) {
    // @ts-expect-error dynamic stuff!
    ;(transformed[addItem] ??= []).push('')
  }

  return transformed
}

const ARRAY_FIELDS_IN_SALES_EVENT = ['productsForSale']
