import {assertNever} from '@giltayar/functional-commons'
import type {SaleHistoryOperation} from '../model.ts'

export function saleHistoryOperationToText(operation: SaleHistoryOperation): string {
  switch (operation) {
    case 'create':
      return 'created'
    case 'update':
      return 'updated'
    case 'delete':
      return 'archived'
    case 'restore':
      return 'restored'
    case 'create-tax-invoice-document':
      return 'created tax invoice document'
    default:
      assertNever(operation)
  }
}
