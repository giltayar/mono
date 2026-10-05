import {assertNever} from '@giltayar/functional-commons'
import {getFixedT} from 'i18next'
import type {SaleHistoryOperation} from '../model/model.ts'

export function saleHistoryOperationToText(operation: SaleHistoryOperation): string {
  const t = getFixedT(null, 'sale')
  switch (operation) {
    case 'create':
      return t('history.created')
    case 'update':
      return t('history.updated')
    case 'delete':
      return t('history.archived')
    case 'restore':
      return t('history.restored')
    case 'connect-sale':
      return t('history.connectedSale')
    case 'refund-sale':
      return t('history.refundedSale')
    case 'cancel-subscription':
      return t('history.canceledSubscription')
    case 'removed-from-subscription':
      return t('history.removedFromSubscription')
    case 'disconnected-manually':
      return t('history.disconnectedManually')
    default:
      assertNever(operation)
  }
}
