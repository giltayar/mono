import {requestContext} from '@fastify/request-context'
import {handleCardcomOneTimeSale, type CardcomSaleWebhookJson} from './model.ts'
import type {ControllerResult} from '../../commons/controller-result.ts'

export async function dealWithCardcomOneTimeSale(
  cardcomSaleWebhookJson: CardcomSaleWebhookJson,
  salesEventNumber: number,
): Promise<ControllerResult> {
  const now = new Date()
  const sql = requestContext.get('sql')!
  const academyIntegration = requestContext.get('academyIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')!

  await handleCardcomOneTimeSale(
    salesEventNumber,
    cardcomSaleWebhookJson,
    now,
    academyIntegration,
    smooveIntegration,
    sql,
  )

  return 'ok'
}
