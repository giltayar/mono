import {requestContext} from '@fastify/request-context'
import {
  listSales,
  querySaleByNumber,
  querySaleByHistoryId,
  searchSalesEvents,
  searchStudents,
  searchProducts,
  createSale as model_createSale,
  updateSale as model_updateSale,
  updateSaleNotes as model_updateSaleNotes,
  deleteSale as model_deleteSale,
  type NewSale,
  type Sale,
  fillInSale,
  querySalePayments,
  findSaleAndStudentBySalesEvent,
  findSaleAndStudentByProduct,
} from './model/model.ts'
import {
  addCardcomSale,
  addNoInvoiceSale,
  findOrCreateStudentFromInvoice as model_findOrCreateStudentFromInvoice,
  refundSale as model_refundSale,
} from './model/model-sale.ts'
import {
  connectSale as model_connectSale,
  disconnectSale as model_disconnectSale,
} from './model/model-connect.ts'
import {
  handleCardcomRecurringPayment,
  cancelSubscription as model_cancelSubscription,
} from './model/model-standing-order.ts'
import {finalHtml, retarget, type ControllerResult} from '../../commons/controller-result.ts'
import {renderSalesPage} from './view/list.ts'
import {
  renderSaleCreatePage,
  renderSaleFormFields,
  renderSalePaymentsPage,
  renderSaleProvidersPage,
  renderSaleViewPage,
  renderStudentSearchDialog,
  renderStudentSearchResults,
  renderStudentInput,
} from './view/view.ts'
import type {Sql} from 'postgres'
import {
  renderSalesEventListPage,
  renderStudentListPage,
  renderProductListPage,
} from './view/list-searches.ts'
import {createStudent as model_createStudent} from '../student/model.ts'
import {exceptionToBanner, exceptionToBannerHtml} from '../../layout/banner.ts'
import type {
  CardcomRecurringOrderWebHookJson,
  CardcomSaleWebhookJson,
} from '@giltayar/carmel-tools-cardcom-integration/types'
import {
  showErrorCancellingSubscription,
  showErrorMultipleSalesFound,
  showErrorSubscriptionNotFound,
  showSubscriptionCancelled,
} from './view/cancel-subscription.ts'
import {querySaleWithProviders} from './model/model-external-providers.ts'
import {listAcademyCourses} from '../../commons/external-provider/academy-courses.ts'
import {listWhatsAppGroups} from '../../commons/external-provider/whatsapp-groups.ts'
import {listSmooveLists} from '../../commons/external-provider/smoove-lists.ts'
import {when} from '@giltayar/functional-commons'

export async function showSaleCreate(
  sale: NewSale | undefined,
  {error}: {error?: any} = {},
): Promise<ControllerResult> {
  const banner = exceptionToBanner('Creating sale error: ', error)

  return finalHtml(renderSaleCreatePage(sale, {banner}))
}

export async function showOngoingSale(sale: NewSale): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!

  return finalHtml(renderSaleFormFields(sale ? await fillInSale(sale, sql) : undefined))
}

export async function createStudentFromInvoice(sale: NewSale): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!
  const cardcomIntegration = requestContext.get('cardcomIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const nowService = requestContext.get('nowService')!
  const logger = requestContext.get('logger')!

  if (!sale.cardcomInvoiceNumber) {
    return finalHtml(renderSaleFormFields(sale), {
      banner: exceptionToBanner('', new Error('Please fill in the Cardcom Invoice Number first')),
    })
  }

  try {
    const student = await model_findOrCreateStudentFromInvoice(
      sale.cardcomInvoiceNumber,
      nowService(),
      cardcomIntegration,
      smooveIntegration,
      sql,
    )

    const updatedSale: NewSale = {
      ...sale,
      studentNumber: student.studentNumber,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
    }

    return finalHtml(renderSaleFormFields(await fillInSale(updatedSale, sql)), {
      banner: {
        message: `Student ${updatedSale.studentName} (${student.studentNumber}) set`,
        type: 'info',
        disappearing: true,
      },
    })
  } catch (error) {
    logger.error({err: error}, 'create-student-from-invoice')
    return finalHtml(renderSaleFormFields(sale), {
      banner: exceptionToBanner('Error creating student from invoice: ', error),
    })
  }
}

export async function showStudentSearchDialog(): Promise<ControllerResult> {
  return finalHtml(renderStudentSearchDialog())
}

export async function showStudentSearchResults(q: string | undefined): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!

  const students = q ? await searchStudents(q, sql) : []

  return finalHtml(renderStudentSearchResults(students))
}

export async function quickCreateStudent(body: {
  quickCreateEmail: string
  quickCreateFirstName: string
  quickCreateLastName: string
  quickCreatePhone?: string
}): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const nowService = requestContext.get('nowService')!
  const logger = requestContext.get('logger')!

  try {
    const studentNumber = await model_createStudent(
      {
        names: [{firstName: body.quickCreateFirstName, lastName: body.quickCreateLastName}],
        emails: [body.quickCreateEmail],
        phones: body.quickCreatePhone ? [body.quickCreatePhone] : undefined,
      },
      'quick-create from sale form',
      smooveIntegration,
      nowService(),
      sql,
    )

    const studentName = `${body.quickCreateFirstName} ${body.quickCreateLastName}`.trim()

    return finalHtml(renderStudentInput(studentNumber, studentName), {
      banner: {
        message: `Student ${studentName} (${studentNumber}) created and set`,
        type: 'info',
        disappearing: true,
      },
    })
  } catch (error) {
    logger.error({err: error}, 'quick-create-student')
    return finalHtml('', {
      banner: exceptionToBanner('Error creating student: ', error),
    })
  }
}

export async function showSalesEventList(q: string | undefined): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!

  const salesEvents = q ? await searchSalesEvents(q, sql) : []

  return finalHtml(renderSalesEventListPage(salesEvents))
}

export async function showStudentList(q: string | undefined): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!

  const students = q ? await searchStudents(q, sql) : []

  return finalHtml(renderStudentListPage(students))
}

export async function showProductList(q: string | undefined): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!

  const products = q ? await searchProducts(q, sql) : []

  return finalHtml(renderProductListPage(products))
}

export async function createSale(sale: NewSale, sql: Sql): Promise<ControllerResult> {
  try {
    const nowService = requestContext.get('nowService')!
    const saleNumber = await model_createSale(sale, undefined, nowService(), sql)

    return {htmxRedirect: `/sales/${saleNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, 'create-sale')
    return showSaleCreate(sale, {error})
  }
}

export async function dealWithCardcomOneTimeSale(
  cardcomSaleWebhookJson: CardcomSaleWebhookJson,
  salesEventNumber: number,
): Promise<ControllerResult> {
  const nowService = requestContext.get('nowService')!
  const now = nowService()
  const sql = requestContext.get('sql')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const cardcomIntegration = requestContext.get('cardcomIntegration')!
  const logger = requestContext.get('logger')!

  await addCardcomSale(
    salesEventNumber,
    cardcomSaleWebhookJson,
    now,
    smooveIntegration,
    cardcomIntegration,
    sql,
    logger,
  )

  return 'ok'
}

export async function dealWithNoInvoiceSale({
  salesEventNumber,
  email,
  phone,
  cellPhone,
  firstName,
  lastName,
}: {
  salesEventNumber: number
  email: string
  phone: string | undefined
  cellPhone: string | undefined
  firstName: string | undefined
  lastName: string | undefined
}): Promise<ControllerResult> {
  const nowService = requestContext.get('nowService')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const now = nowService()
  const sql = requestContext.get('sql')!
  const logger = requestContext.get('logger')!

  await addNoInvoiceSale(
    salesEventNumber,
    {email, phone, cellPhone, firstName, lastName},
    now,
    smooveIntegration,
    sql,
    logger,
  )

  return 'ok'
}

export async function dealWithCardcomRecurringPayment(
  cardcomSaleWebhookJson: CardcomRecurringOrderWebHookJson,
): Promise<ControllerResult> {
  const nowService = requestContext.get('nowService')!
  const sql = requestContext.get('sql')!
  const now = nowService()
  const cardcomIntegration = requestContext.get('cardcomIntegration')!
  const logger = requestContext.get('logger')!

  await handleCardcomRecurringPayment(cardcomSaleWebhookJson, now, sql, cardcomIntegration, logger)

  return 'ok'
}

export async function showSales(
  {
    flash,
    withArchived,
    query,
    page,
  }: {flash?: string; withArchived: boolean; query: string | undefined; page: number},
  sql: Sql,
): Promise<ControllerResult> {
  const sales = await listSales(sql, {withArchived, query: query ?? '', limit: 50, page})

  return finalHtml(renderSalesPage(flash, sales, {withArchived, query: query ?? '', page}))
}

export async function showSale(
  saleNumber: number,
  saleWithError: {sale: Sale | undefined; error: any; operation: string} | undefined,
  sql: Sql,
): Promise<ControllerResult> {
  const saleWithHistory = await querySaleByNumber(saleNumber, sql)

  if (!saleWithHistory) {
    return {status: 404, body: 'Sale not found'}
  }

  const banner = exceptionToBanner(`${saleWithError?.operation} sale error: `, saleWithError?.error)

  if (saleWithError?.sale) {
    saleWithHistory.sale = {
      ...saleWithHistory.sale,
      ...saleWithError.sale,
    }
  }

  return finalHtml(renderSaleViewPage(saleWithHistory.sale, saleWithHistory.history, {banner}))
}

export async function showSalePayments(saleNumber: number, sql: Sql): Promise<ControllerResult> {
  const saleWithPayments = await querySalePayments(saleNumber, sql)

  if (!saleWithPayments) {
    return {status: 404, body: 'Sale not found'}
  }
  return finalHtml(renderSalePaymentsPage(saleWithPayments))
}

export async function showSaleProviders(saleNumber: number, sql: Sql): Promise<ControllerResult> {
  const academyIntegration = requestContext.get('academyIntegration')
  const smooveIntegration = requestContext.get('smooveIntegration')
  const whatsappIntegration = requestContext.get('whatsappIntegration')!
  const nowService = requestContext.get('nowService')!
  const now = nowService()
  const [academyCourses, whatsappGroups, smooveLists] = await Promise.all([
    when(academyIntegration, (academyIntegration) => listAcademyCourses(academyIntegration, now)),
    listWhatsAppGroups(whatsappIntegration, now),
    when(smooveIntegration, (smooveIntegration) => listSmooveLists(smooveIntegration, now)),
  ])

  const saleWithProviders = await querySaleWithProviders(
    saleNumber,
    academyIntegration,
    smooveIntegration,
    whatsappIntegration,
    academyCourses,
    smooveLists,
    whatsappGroups,
    sql,
  )

  if (!saleWithProviders) {
    return {status: 404, body: 'Sale not found'}
  }
  return finalHtml(renderSaleProvidersPage(saleWithProviders))
}

export async function showSaleInHistory(
  saleNumber: number,
  operationId: string,
  sql: Sql,
): Promise<ControllerResult> {
  const saleWithHistory = await querySaleByHistoryId(saleNumber, operationId, sql)

  if (!saleWithHistory) {
    return {status: 404, body: 'Sale not found'}
  }

  return finalHtml(renderSaleViewPage(saleWithHistory.sale, saleWithHistory.history))
}

export async function updateSale(sale: Sale, sql: Sql): Promise<ControllerResult> {
  const logger = requestContext.get('logger')!
  try {
    const nowService = requestContext.get('nowService')!
    const saleNumber = await model_updateSale(sale, undefined, nowService(), sql)

    if (!saleNumber) {
      return {status: 404, body: 'Sale not found'}
    }

    return {htmxRedirect: `/sales/${saleNumber}`}
  } catch (error) {
    logger.error({err: error}, 'update-sale')
    return showSale(sale.saleNumber, {sale, error, operation: 'Updating'}, sql)
  }
}

export async function updateSaleNotes(
  saleNumber: number,
  notes: string | undefined,
  sql: Sql,
): Promise<ControllerResult> {
  const logger = requestContext.get('logger')!
  try {
    const nowService = requestContext.get('nowService')!
    const result = await model_updateSaleNotes(saleNumber, notes, nowService(), sql)

    if (!result) {
      return {status: 404, body: 'Sale not found'}
    }

    return {htmxRedirect: `/sales/${saleNumber}`}
  } catch (error) {
    logger.error({err: error}, 'update-sale-notes')
    return retarget(exceptionToBannerHtml('Error updating notes: ', error), '#banner-container')
  }
}

export async function deleteSale(
  saleNumber: number,
  deleteOperation: 'delete' | 'restore',
  sql: Sql,
): Promise<ControllerResult> {
  try {
    const nowService = requestContext.get('nowService')!
    const operationId = await model_deleteSale(
      saleNumber,
      undefined,
      deleteOperation,
      nowService(),
      sql,
    )

    if (!operationId) {
      return {status: 404, body: 'Sale not found'}
    }

    return {htmxRedirect: `/sales/${saleNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, 'delete-sale')
    return retarget(
      await showSale(
        saleNumber,
        {
          sale: undefined,
          error,
          operation: deleteOperation === 'delete' ? 'Archiving' : 'Restoring',
        },
        sql,
      ),
      'body',
    )
  }
}

export async function connectSale(saleNumber: number, sale: Sale): Promise<ControllerResult> {
  try {
    const sql = requestContext.get('sql')!
    const cardcomIntegration = requestContext.get('cardcomIntegration')!
    const smooveIntegration = requestContext.get('smooveIntegration')
    const academyIntegration = requestContext.get('academyIntegration')
    const whatsappIntegration = requestContext.get('whatsappIntegration')!
    const nowService = requestContext.get('nowService')!
    const logger = requestContext.get('logger')!
    const now = nowService()

    await model_updateSale(sale, undefined, now, sql)

    await model_connectSale(
      saleNumber,
      now,
      sql,
      cardcomIntegration,
      smooveIntegration,
      academyIntegration,
      whatsappIntegration,
      logger,
    )

    return {htmxRedirect: `/sales/${saleNumber}`}
  } catch (err) {
    const logger = requestContext.get('logger')!
    logger.error({err}, 'connect-sale')

    return retarget(exceptionToBannerHtml('Error connecting sale: ', err), '#banner-container')
  }
}

export async function refundSale(saleNumber: number): Promise<ControllerResult> {
  try {
    const sql = requestContext.get('sql')!
    const cardcomIntegration = requestContext.get('cardcomIntegration')!
    const nowService = requestContext.get('nowService')!
    const logger = requestContext.get('logger')!
    const now = nowService()

    await model_refundSale(saleNumber, now, sql, cardcomIntegration, logger)

    return {htmxRedirect: `/sales/${saleNumber}`}
  } catch (err) {
    const logger = requestContext.get('logger')!
    logger.error({err}, 'refund-sale')

    return retarget(exceptionToBannerHtml('Error refunding sale: ', err), '#banner-container')
  }
}

export async function disconnectSale(saleNumber: number): Promise<ControllerResult> {
  try {
    const sql = requestContext.get('sql')!
    const academyIntegration = requestContext.get('academyIntegration')
    const smooveIntegration = requestContext.get('smooveIntegration')
    const whatsappIntegration = requestContext.get('whatsappIntegration')!
    const nowService = requestContext.get('nowService')!
    const logger = requestContext.get('logger')!
    const now = nowService()

    await model_disconnectSale(
      {saleNumber, reason: 'disconnected-manually'},
      academyIntegration,
      smooveIntegration,
      whatsappIntegration,
      now,
      sql,
      logger,
    )

    return {htmxRedirect: `/sales/${saleNumber}`}
  } catch (err) {
    const logger = requestContext.get('logger')!
    logger.error({err}, 'disconnect-sale')

    return retarget(exceptionToBannerHtml('Error disconnecting sale: ', err), '#banner-container')
  }
}

export async function cancelSubscriptionBySalesEvent(
  email: string,
  salesEventNumber: number,
): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!
  const cardcomIntegration = requestContext.get('cardcomIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const nowService = requestContext.get('nowService')!
  const logger = requestContext.get('logger')!
  const now = nowService()

  try {
    const {studentName, productName, saleNumber} = await findSaleAndStudentBySalesEvent(
      email,
      salesEventNumber,
      sql,
    )

    if (studentName === undefined || productName === undefined || saleNumber === undefined) {
      return finalHtml(
        showErrorSubscriptionNotFound({
          email,
          identifier: {salesEventNumber},
          studentName,
          productName,
        }),
      )
    }

    await model_cancelSubscription(
      email,
      saleNumber,
      sql,
      cardcomIntegration,
      smooveIntegration,
      now,
      logger,
    )

    return finalHtml(showSubscriptionCancelled(email, studentName, productName))
  } catch (err: any) {
    const logger = requestContext.get('logger')!
    logger.error({err}, 'cancel-subscription-by-sales-event')

    if (err.code === 'ERR_MULTIPLE_SALES_FOUND') {
      return finalHtml(showErrorMultipleSalesFound(email))
    }

    return finalHtml(showErrorCancellingSubscription(email, {salesEventNumber}))
  }
}

export async function cancelSubscriptionByProduct(
  email: string,
  productNumber: number,
): Promise<ControllerResult> {
  const sql = requestContext.get('sql')!
  const cardcomIntegration = requestContext.get('cardcomIntegration')!
  const smooveIntegration = requestContext.get('smooveIntegration')
  const nowService = requestContext.get('nowService')!
  const logger = requestContext.get('logger')!
  const now = nowService()

  try {
    const {studentName, productName, saleNumber} = await findSaleAndStudentByProduct(
      email,
      productNumber,
      sql,
    )

    if (studentName === undefined || productName === undefined || saleNumber === undefined) {
      return finalHtml(
        showErrorSubscriptionNotFound({
          email,
          identifier: {productNumber},
          studentName,
          productName,
        }),
      )
    }

    await model_cancelSubscription(
      email,
      saleNumber,
      sql,
      cardcomIntegration,
      smooveIntegration,
      now,
      logger,
    )

    return finalHtml(showSubscriptionCancelled(email, studentName, productName))
  } catch (err: any) {
    const logger = requestContext.get('logger')!
    logger.error({err}, 'cancel-subscription-by-product')

    if (err.code === 'ERR_MULTIPLE_SALES_FOUND') {
      return finalHtml(showErrorMultipleSalesFound(email))
    }

    return finalHtml(showErrorCancellingSubscription(email, {productNumber}))
  }
}
