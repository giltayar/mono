import type {CardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import type {
  CardcomRecurringOrderWebHookJson,
  CardcomDetailRecurringJson,
} from '@giltayar/carmel-tools-cardcom-integration/types'
import type {FastifyBaseLogger} from 'fastify'
import type {Sql} from 'postgres'
import {type StandingOrderPaymentResolution} from './model-sale.ts'
import {moveStudentToSmooveCancelledSubscriptionList} from './model-external-providers.ts'
import {disconnectSale, type SaleConnectionToStudent} from './model-connect.ts'
import {type SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import {registerJobHandler, type JobSubmitter} from '../../job/job-handlers.ts'
import {Temporal} from '@js-temporal/polyfill'
import type {NowService} from '../../../commons/now-service.ts'
import type {WhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'

let createDisconnectSaleFromExternalProvidersJob: JobSubmitter<SaleConnectionToStudent> | undefined

export async function initializeJobHandlers(
  academyIntegration: AcademyIntegrationService,
  smooveIntegration: SmooveIntegrationService,
  whatsappIntegration: WhatsAppIntegrationService,
  nowService: NowService,
) {
  createDisconnectSaleFromExternalProvidersJob = registerJobHandler<SaleConnectionToStudent>(
    'disconnecting-sale-from-external-providers',
    async (payload, _attempt, logger, sql) => {
      await disconnectSale(
        payload,
        academyIntegration,
        smooveIntegration,
        whatsappIntegration,
        nowService(),
        sql,
        logger,
      )
    },
  )
}

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
  smooveIntegration: SmooveIntegrationService,
  now: Date,
  parentLogger: FastifyBaseLogger,
) {
  const logger = parentLogger.child({email, saleNumber})
  await sql.begin(async (sql) => {
    const result = (await sql`
      SELECT
        recurring_order_id,
        s.student_number,
        sl.sale_number,
        fsl.timestamp AS sale_creation_timestamp
      FROM
        student_email se
      JOIN student_history sh ON sh.data_id = se.data_id
      JOIN student s ON s.student_number = sh.student_number

      JOIN sale_data sd ON sd.student_number = s.student_number
      JOIN sale_history slh ON slh.data_id = sd.data_id
      JOIN sale sl ON sl.sale_number = slh.sale_number

      JOIN sale_history fsl ON fsl.sale_number = ${saleNumber} AND fsl.operation = 'create'

      JOIN sale_data_cardcom sdc ON sdc.data_cardcom_id = sl.data_cardcom_id

      WHERE
        se.email = ${email} AND
        sl.sale_number = ${saleNumber}
    `) as {recurringOrderId: string; studentNumber: number; saleCreationTimestamp: Date}[]

    if (result.length === 0) {
      throw new Error('No subscription found for given email and sales event')
    }

    const {recurringOrderId, saleCreationTimestamp, studentNumber} = result[0]

    logger.info({recurringOrderId: recurringOrderId}, 'disabling-cardcom-recurring-payment')
    await cardcomIntegration.enableDisableRecurringPayment(recurringOrderId, 'disable')

    logger.info({recurringOrderId: recurringOrderId}, 'moving-student-to-cancelled-smoove-listv')
    await moveStudentToSmooveCancelledSubscriptionList(
      studentNumber,
      saleNumber,
      smooveIntegration,
      sql,
      logger,
    )

    logger.info({recurringOrderId: recurringOrderId}, 'creating-history-for-cancellation')
    const saleDataActiveId = crypto.randomUUID()
    const historyId = crypto.randomUUID()
    logger.info({recurringOrderId: recurringOrderId, historyId}, 'creating-history')

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

    const disconnectTime = computeDisconnectTime({
      unsubscribeTimestamp: now,
      subscriptionTimestamp: saleCreationTimestamp,
    })
    logger.info(
      {saleNumber, studentNumber, disconnectTime: disconnectTime.toISOString()},
      'creating-disconnect-job',
    )
    await createDisconnectSaleFromExternalProvidersJob!({saleNumber, studentNumber}, sql, {
      scheduledAt: disconnectTime,
    })
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

function computeDisconnectTime({
  unsubscribeTimestamp: unsubscriptionTimestamp,
  subscriptionTimestamp,
}: {
  unsubscribeTimestamp: Date
  subscriptionTimestamp: Date
}): Date {
  const subscriptionDate = Temporal.Instant.fromEpochMilliseconds(subscriptionTimestamp.getTime())
    .toZonedDateTimeISO('UTC')
    .toPlainDate()

  const unsubscriptionDate = Temporal.Instant.fromEpochMilliseconds(
    unsubscriptionTimestamp.getTime(),
  )
    .toZonedDateTimeISO('UTC')
    .toPlainDate()

  let removalDate = unsubscriptionDate

  if (removalDate.day >= subscriptionDate.day) {
    removalDate = removalDate.add({months: 1}, {overflow: 'constrain'})
  }

  removalDate = removalDate.with({day: subscriptionDate.day}, {overflow: 'constrain'})

  return new Date(
    removalDate
      .toZonedDateTime({plainTime: Temporal.PlainTime.from('05:00'), timeZone: 'Asia/Jerusalem'})
      .toInstant().epochMilliseconds,
  )
}
