import {assertNever} from '@giltayar/functional-commons'
import type {SaleHistoryOperation} from '../model/model.ts'

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
    case 'connect-manual-sale':
      return 'connected manual sale'
    case 'cancel-subscription':
      return 'canceled subscription'
    case 'removed-from-subscription':
      return 'removed from subscription'
    default:
      assertNever(operation)
  }
}
