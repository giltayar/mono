import type {CardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import type {
  CardcomRecurringOrderWebHookJson,
  CardcomDetailRecurringJson,
} from '@giltayar/carmel-tools-cardcom-integration/types'
import type {FastifyBaseLogger} from 'fastify'
import type {Sql} from 'postgres'
import {type StandingOrderPaymentResolution} from './model-sale.ts'
import {type SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'

export async function handleCardcomRecurringPayment(
  cardcomRecurringOrderWebHookJson: CardcomRecurringOrderWebHookJson,
  now: Date,
  sql: Sql,
  cardcomIntegration: CardcomIntegrationService,
  logger: FastifyBaseLogger,
) {
  logger.info('handle-cardcom-recurring-payment-started')
  if (cardcomRecurringOrderWebHookJson.RecordType === 'MasterRecurring') {
    logger.info('master-recurring-payment-no-action-needed')
    return
  }
  const cardcomDetailRecurringJson: CardcomDetailRecurringJson = cardcomRecurringOrderWebHookJson

  await sql.begin(async (sql) => {
    const recurringId = cardcomDetailRecurringJson.RecurringId
    const saleStandingOrderPaymentId = crypto.randomUUID()

    const referencesResult = await sql<{saleNumber: string; dataId: string}[]>`
      SELECT
        s.sale_number,
        sh.data_id
      FROM sale_data_cardcom sdc
      JOIN sale s ON s.data_cardcom_id = sdc.data_cardcom_id
      JOIN sale_history sh on sh.id = s.last_history_id
      WHERE
        sdc.recurring_order_id = ${recurringId}
    `

    if (referencesResult.length === 0) {
      logger.info({recurringId}, 'no-sale-standing-order-payment-found')
      return
    }

    const standingOrderPaymentExistsResult = await sql<{1: number}[]>`
      SELECT 1
      FROM sale_standing_order_cardcom_recurring_payment ssocrp
      WHERE ssocrp.invoice_document_number = ${cardcomDetailRecurringJson.DocumentNumber}
    `

    if (standingOrderPaymentExistsResult.length > 0) {
      logger.info(
        {invoiceDocumentNumber: cardcomDetailRecurringJson.DocumentNumber},
        'sale-standing-order-payment-already-exists',
      )
      return
    }
    await sql`
      INSERT INTO sale_standing_order_payments ${sql({
        id: saleStandingOrderPaymentId,
        saleNumber: referencesResult[0].saleNumber,
        saleDataId: referencesResult[0].dataId,
        timestamp: now,
        paymentRevenue: cardcomDetailRecurringJson.Sum,
        resolution: cardcomStatusToStandingOrderPaymentResolution(
          cardcomDetailRecurringJson.Status,
        ),
        isFirstPayment: false,
      })}`

    const cardcomInvoiceDocumentUrl = (
      await cardcomIntegration.createTaxInvoiceDocumentUrl(
        cardcomDetailRecurringJson.DocumentNumber.toString(),
      )
    ).url

    await sql`
      INSERT INTO sale_standing_order_cardcom_recurring_payment ${sql({
        sale_standing_order_payment_id: saleStandingOrderPaymentId,
        status: cardcomDetailRecurringJson.Status,
        invoiceDocumentNumber: cardcomDetailRecurringJson.DocumentNumber,
        internalDealNumber: cardcomDetailRecurringJson.InternalDealNumber,
        invoiceDocumentUrl: cardcomInvoiceDocumentUrl,
      })}`
  })
}

export async function cancelSubscription(
  email: string,
  saleNumber: number,
  sql: Sql,
  cardcomIntegration: CardcomIntegrationService,
  _academyIntegration: AcademyIntegrationService,
  _smooveIntegration: SmooveIntegrationService,
  now: Date,
  parentLogger: FastifyBaseLogger,
) {
  const logger = parentLogger.child({email, saleNumber})
  await sql.begin(async (sql) => {
    const result = (await sql`
      SELECT
        recurring_order_id,
        s.student_number,
        sl.sale_number
      FROM
        student_email se
      JOIN student_history sh ON sh.data_id = se.data_id
      JOIN student s ON s.student_number = sh.student_number

      JOIN sale_data sd ON sd.student_number = s.student_number
      JOIN sale_history slh ON slh.data_id = sd.data_id
      JOIN sale sl ON sl.sale_number = slh.sale_number

      JOIN sale_data_cardcom sdc ON sdc.data_cardcom_id = sl.data_cardcom_id

      WHERE
        se.email = ${email} AND
        sl.sale_number = ${saleNumber}
    `) as {recurringOrderId: string; studentNumber: number}[]

    if (result.length === 0) {
      throw new Error('No subscription found for given email and sales event')
    }

    const {recurringOrderId} = result[0]
    logger.info(
      {recurringOrderId: recurringOrderId, saleNumber},
      'disconnecting-subscription-from-external-providers',
    )
    // await disconnectSaleFromExternalProviders(
    //   {studentNumber, saleNumber},
    //   academyIntegration,
    //   smooveIntegration,
    //   sql,
    //   logger.child({
    //     recurringOrderId: recurringOrderId,
    //     saleNumber,
    //   }),
    // )

    logger.info({recurringOrderId: recurringOrderId}, 'disabling-cardcom-recurring-payment')
    await cardcomIntegration.enableDisableRecurringPayment(recurringOrderId, 'disable')

    const saleDataActiveId = crypto.randomUUID()
    const historyId = crypto.randomUUID()

    await sql`
      INSERT INTO sale_data_active ${sql({
        dataActiveId: saleDataActiveId,
        isActive: false,
      })}
    `

    await sql`
      INSERT INTO sale_history
        (id, data_id, data_product_id, sale_number, timestamp, operation, operation_reason, data_manual_id, data_active_id)
      SELECT
        ${historyId},
        sh.data_id,
        sh.data_product_id,
        sh.sale_number,
        ${now},
        'cancel-subscription',
        null,
        sh.data_manual_id,
        ${saleDataActiveId}
      FROM
        sale_history sh
      WHERE sh.id = (
        SELECT s.last_history_id
        FROM sale s
        WHERE s.sale_number = ${saleNumber}
      )
    `

    await sql`
      UPDATE sale
      SET last_history_id = ${historyId}
      WHERE sale_number = ${saleNumber}
    `
  })
}

export function cardcomStatusToStandingOrderPaymentResolution(
  status: string,
): StandingOrderPaymentResolution {
  switch (status) {
    case 'SUCCESSFUL':
    case 'PAYBYOTHERE':
    case 'PAYBYOTHER':
      return 'payed'
    case 'PENDINGFORPROCESSING':
    case 'DEBTAUTOBILLING':
      return 'failure-but-retrying'
    case 'ON_HOLD':
      return 'on-hold'
    case 'OTHER':
    default:
      return 'failure-but-retrying'
  }
}
