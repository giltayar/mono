import {requestContext} from '@fastify/request-context'
import {handleCardcomOneTimeSale, type CardcomSaleWebhookJson} from './model.ts'

export async function dealWithCardcomOneTimeSale(
  cardcomSaleWebhookJson: CardcomSaleWebhookJson,
  salesEventNumber: number,
) {
  const now = new Date()
  const sql = requestContext.get('sql')!
  const academyIntegration = requestContext.get('academyIntegration')!

  await handleCardcomOneTimeSale(
    salesEventNumber,
    cardcomSaleWebhookJson,
    now,
    academyIntegration,
    sql,
  )
}
