import type {
  AcademyCourse,
  AcademyIntegrationService,
} from '@giltayar/carmel-tools-academy-integration/service'
import type {
  SmooveIntegrationService,
  SmooveList,
} from '@giltayar/carmel-tools-smoove-integration/service'
import type {FastifyBaseLogger} from 'fastify'
import type {Sql} from 'postgres'
import retry from 'p-retry'
import type {
  WhatsAppGroup,
  WhatsAppIntegrationService,
} from '@giltayar/carmel-tools-whatsapp-integration/service'
import {humanIsraeliPhoneNumberToWhatsAppId} from '@giltayar/carmel-tools-whatsapp-integration/utils'
import type {WhatsAppGroupId} from '@giltayar/carmel-tools-whatsapp-integration/types'

export type SaleWithProviders = {
  saleNumber: number
  products: {
    productNumber: number
    productName: string
    academyCourses: {courseId: string; name: string; isConnected: boolean}[]
    smooveLists: {
      isListConnected: boolean
      listName: string
      isCancelledListConnected: boolean
      cancelledListName: string
      isRemovedListConnected: boolean
      removedListName: string
    }
    whatsAppGroups: {groupId: string; name: string; isConnected: boolean}[]
  }[]
}

export async function querySaleWithProviders(
  saleNumber: number,
  academyIntegration: AcademyIntegrationService,
  smooveIntegration: SmooveIntegrationService,
  whatsappIntegration: WhatsAppIntegrationService,
  academyCourses: AcademyCourse[],
  smooveLists: SmooveList[],
  whatsappGroups: WhatsAppGroup[],
  sql: Sql,
): Promise<SaleWithProviders | undefined> {
  const academyCoursesNames = new Map<number, AcademyCourse>(academyCourses.map((c) => [c.id, c]))
  const smooveListsMap = new Map<number, SmooveList>(smooveLists.map((l) => [l.id, l]))
  const whatsappGroupsMap = new Map<string, WhatsAppGroup>(whatsappGroups.map((g) => [g.id, g]))

  const saleResult = (await sql`
    SELECT
      s.sale_number,
      ste.email,
      stp.phone,
      sis.smoove_contact_id,
      (
        json_agg(
          json_build_object(
            'product_number', p.product_number,
            'product_name', pd.name,
            'academy_courses',
              (
                SELECT json_agg(pac.workshop_id)
                FROM product_academy_course pac
                WHERE pac.data_id = ph.data_id
              ),
            'smoove_lists', json_build_object(
              'list_id', pis.list_id,
              'cancelled_list_id', pis.cancelled_list_id,
              'removed_list_id', pis.removed_list_id
            ),
            'whatsAppGroups',
              (
                SELECT json_agg(pwg.whatsapp_group_id)
                FROM product_whatsapp_group pwg
                WHERE pwg.data_id = ph.data_id
              )
          )
        )
      ) as products
    FROM sale s
    JOIN sale_history sh ON sh.id = s.last_history_id
    JOIN sale_data sd ON sd.data_id = sh.data_id
    JOIN sale_data_product sdp ON sdp.data_product_id = sh.data_product_id

    JOIN student st ON st.student_number = sd.student_number
    JOIN student_history sth ON sth.id = st.last_history_id
    LEFT JOIN student_email ste ON ste.data_id = sth.data_id AND ste.item_order = 0
    LEFT JOIN student_phone stp ON stp.data_id = sth.data_id AND stp.item_order = 0
    LEFT JOIN student_integration_smoove sis ON sis.data_id = sth.data_id

    JOIN product p ON p.product_number = sdp.product_number
    JOIN product_history ph ON ph.id = p.last_history_id
    JOIN product_data pd ON pd.data_id = ph.data_id

    LEFT JOIN product_integration_smoove pis ON pis.data_id = ph.data_id

    WHERE s.sale_number = ${saleNumber}

    GROUP BY s.sale_number, ste.email, stp.phone, sis.smoove_contact_id
  `) as SaleWithProvidersResult[]

  if (saleResult.length === 0) {
    return undefined
  }
  const saleRow = saleResult[0]
  const email = saleRow.email

  const academyCoursesInSale = saleRow.products.flatMap((product) => product.academyCourses ?? [])
  const whatsAppGroupsInSale = saleRow.products.flatMap((product) => product.whatsAppGroups ?? [])

  const academyConnnectionsP = email
    ? Promise.all(
        academyCoursesInSale.map(async (courseId) =>
          academyIntegration.isStudentEnrolledInCourse(email, parseInt(courseId)),
        ),
      )
    : Promise.resolve([])
  const smooveContactP = saleRow.smooveContactId
    ? smooveIntegration.fetchSmooveContact(saleRow.smooveContactId)
    : undefined
  const whatsappGroupParticipantsP = Promise.all(
    whatsAppGroupsInSale.map(async (groupId) =>
      whatsappIntegration.listParticipantsInGroup(groupId as WhatsAppGroupId),
    ),
  )

  const [academyConnnections, smooveContact, whatsappGroupParticipants] = await Promise.all([
    academyConnnectionsP,
    smooveContactP,
    whatsappGroupParticipantsP,
  ])
  const phone = saleRow.phone
  const whatsappContactId = phone ? humanIsraeliPhoneNumberToWhatsAppId(phone) : undefined

  return {
    saleNumber: saleRow.saleNumber,
    products: saleRow.products.map((product) => ({
      productNumber: product.productNumber,
      productName: product.productName,
      academyCourses: (product.academyCourses ?? []).map((courseId) => ({
        courseId,
        isConnected: !!academyConnnections[academyCoursesInSale.findIndex((c) => c === courseId)],
        name: academyCoursesNames.get(parseInt(courseId))?.name ?? '',
      })),
      smooveLists: {
        isListConnected: !!smooveContact?.lists_Linked.includes(
          parseInt(product.smooveLists.listId ?? '0'),
        ),
        listName: smooveListsMap.get(parseInt(product.smooveLists.listId ?? '0'))?.name ?? '',
        isCancelledListConnected: !!smooveContact?.lists_Linked.includes(
          parseInt(product.smooveLists.cancelledListId ?? '0'),
        ),
        cancelledListName:
          smooveListsMap.get(parseInt(product.smooveLists.cancelledListId ?? '0'))?.name ?? '',
        isRemovedListConnected: !!smooveContact?.lists_Linked.includes(
          parseInt(product.smooveLists.removedListId ?? '0'),
        ),
        removedListName:
          smooveListsMap.get(parseInt(product.smooveLists.removedListId ?? '0'))?.name ?? '',
      },
      whatsAppGroups: phone
        ? (product.whatsAppGroups ?? []).map((groupId) => ({
            groupId,
            name: whatsappGroupsMap.get(groupId)?.name ?? '',
            isConnected: !!whatsappGroupParticipants[
              whatsAppGroupsInSale.findIndex((g) => g === groupId)
            ].find((p) => whatsappContactId === p),
          }))
        : [],
    })),
  }
}

export async function moveStudentToSmooveCancelledSubscriptionList(
  studentNumber: number,
  saleNumber: number,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
  logger: FastifyBaseLogger,
) {
  const smooveProductsLists = await sql<
    {
      listId: string
      cancellingListId: string
      cancelledListId: string
      removedListId: string
    }[]
  >`
    SELECT
      pis.list_id as list_id,
      pis.cancelling_list_id,
      pis.cancelled_list_id,
      pis.removed_list_id
    FROM sale_data_product sip
    JOIN sale s ON s.last_data_product_id = sip.data_product_id
    JOIN product p ON p.product_number = sip.product_number
    JOIN product_integration_smoove pis ON pis.data_id = p.last_data_id
    WHERE s.sale_number = ${saleNumber};
  `

  const smooveContactIdResult = await sql<{smooveContactId: string}[]>`
    SELECT
      smoove_contact_id
    FROM student
    INNER JOIN student_integration_smoove sis ON sis.data_id = student.last_data_id
    WHERE student_number = ${studentNumber}
  `

  const smooveContactId =
    smooveContactIdResult.length > 0 ? smooveContactIdResult[0].smooveContactId : undefined

  if (!smooveContactId) {
    logger.info('smoove-contact-id-not-found-skipping-move')
    return
  }

  const result = await Promise.allSettled(
    smooveProductsLists.map((smooveProductLists) =>
      smooveIntegration.changeContactLinkedLists(parseInt(smooveContactId), {
        subscribeTo: [parseInt(smooveProductLists.cancelledListId)],
        unsubscribeFrom: [
          parseInt(smooveProductLists.listId),
          parseInt(smooveProductLists.cancellingListId),
          parseInt(smooveProductLists.removedListId),
        ],
      }),
    ),
  )

  for (const [is, res] of Object.entries(result)) {
    const i = parseInt(is)
    if (res.status === 'rejected') {
      logger.error(
        {err: res.reason, courseId: smooveProductsLists[i].listId, i, studentNumber},
        'adding-student-to-academy-course-failed',
      )
    } else {
      logger.info(
        {courseId: smooveProductsLists[i].listId, i, studentNumber},
        'adding-student-to-academy-course-succeeded',
      )
    }
  }
}

export async function moveStudentToSmooveRemovedSubscriptionList(
  studentNumber: number,
  saleNumber: number,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
  logger: FastifyBaseLogger,
) {
  const smooveProductsLists = await sql<
    {
      listId: string
      cancellingListId: string
      cancelledListId: string
      removedListId: string
    }[]
  >`
    SELECT
      pis.list_id as list_id,
      pis.cancelling_list_id,
      pis.cancelled_list_id,
      pis.removed_list_id
    FROM sale_data_product sip
    JOIN sale s ON s.last_data_product_id = sip.data_product_id
    JOIN product p ON p.product_number = sip.product_number
    JOIN product_integration_smoove pis ON pis.data_id = p.last_data_id
    WHERE s.sale_number = ${saleNumber};
  `

  const smooveContactIdResult = await sql<{smooveContactId: string}[]>`
    SELECT
      smoove_contact_id
    FROM student
    INNER JOIN student_integration_smoove sis ON sis.data_id = student.last_data_id
    WHERE student_number = ${studentNumber}
  `

  const smooveContactId =
    smooveContactIdResult.length > 0 ? smooveContactIdResult[0].smooveContactId : undefined

  if (!smooveContactId) {
    logger.info('smoove-contact-id-not-found-skipping-move')
    return
  }

  const result = await Promise.allSettled(
    smooveProductsLists.map((smooveProductLists) =>
      smooveIntegration.changeContactLinkedLists(parseInt(smooveContactId), {
        subscribeTo: [parseInt(smooveProductLists.removedListId)],
        unsubscribeFrom: [
          parseInt(smooveProductLists.listId),
          parseInt(smooveProductLists.cancellingListId),
          parseInt(smooveProductLists.cancelledListId),
        ],
      }),
    ),
  )

  for (const [is, res] of Object.entries(result)) {
    const i = parseInt(is)
    if (res.status === 'rejected') {
      logger.error(
        {err: res.reason, courseId: smooveProductsLists[i].listId, i, studentNumber},
        'adding-student-to-academy-course-failed',
      )
    } else {
      logger.info(
        {courseId: smooveProductsLists[i].listId, i, studentNumber},
        'adding-student-to-academy-course-succeeded',
      )
    }
  }
}

export async function disconnectStudentFromAcademyCourses(
  saleNumber: number,
  studentEmail: string,
  academyIntegration: AcademyIntegrationService,
  sql: Sql,
  logger: FastifyBaseLogger,
): Promise<void> {
  // Get student info and all academy courses for products in the actual sale
  const courses = await sql<{courseId: string}[]>`
    SELECT DISTINCT
      pac.workshop_id as course_id

    FROM sale_data_product sip
    INNER JOIN sale s ON s.last_data_product_id = sip.data_product_id
    INNER JOIN product p ON p.product_number = sip.product_number
    INNER JOIN product_academy_course pac ON pac.data_id = p.last_data_id
    WHERE s.sale_number = ${saleNumber}
    ORDER BY pac.workshop_id
  `

  logger.info({courses}, 'academy-courses-to-disconnect')

  for (const {courseId} of courses) {
    try {
      await retry(
        () => academyIntegration.removeStudentFromCourse(studentEmail, parseInt(courseId)),
        {
          retries: 5,
          minTimeout: 1000,
          maxTimeout: 5000,
        },
      )
      logger.info(
        {courseId, student: studentEmail},
        'removing-student-from-academy-course-succeeded',
      )
    } catch (err) {
      logger.error(
        {err, courseId, student: studentEmail},
        'removing-student-from-academy-course-failed',
      )
    }
  }
}

export async function removeStudentFromWhatsAppGroups(
  saleNumber: number,
  studentPhone: string,
  whatsappIntegration: WhatsAppIntegrationService,
  sql: Sql,
  logger: FastifyBaseLogger,
): Promise<void> {
  // Get student info and all academy courses for products in the actual sale
  const whatsapGroupIdResults = await sql<{whatsappGroupId: string}[]>`
    SELECT DISTINCT
      pwg.whatsapp_group_id
    FROM sale s
    JOIN sale_history sh ON sh.id = s.last_history_id
    JOIN sale_data_product sdp ON sdp.data_product_id = sh.data_product_id

    JOIN product p ON p.product_number = sdp.product_number
    JOIN product_history ph ON ph.id = p.last_history_id

    JOIN product_whatsapp_group pwg ON pwg.data_id = ph.data_id

    WHERE s.sale_number = ${saleNumber}
    ORDER BY pwg.whatsapp_group_id
  `

  const whatsapGroupIds = whatsapGroupIdResults.map((r) => r.whatsappGroupId)

  logger.info({whatsapGroupIds}, 'whatsapp-group-ids-to-disconnect')

  const result = await Promise.allSettled(
    whatsapGroupIds.map((whatsapGroupId) =>
      retry(
        () =>
          whatsappIntegration.removeParticipantFromGroup(
            whatsapGroupId as WhatsAppGroupId,
            humanIsraeliPhoneNumberToWhatsAppId(studentPhone),
          ),
        {
          retries: 5,
          minTimeout: 1000,
          maxTimeout: 5000,
        },
      ),
    ),
  )

  for (const [is, res] of Object.entries(result)) {
    const i = parseInt(is)
    if (res.status === 'rejected') {
      logger.error(
        {err: res.reason, whatsapGroupId: whatsapGroupIds[i], i, student: studentPhone},
        'removing-student-from-whatsapp-group-failed',
      )
    } else {
      logger.info(
        {whatsapGroupId: whatsapGroupIds[i], i, student: studentPhone},
        'removing-student-from-whatsapp-group-succeeded',
      )
    }
  }
}

export async function subscribeStudentInSmooveLists(
  studentNumber: number,
  saleNumber: number,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
  logger: FastifyBaseLogger,
) {
  const smooveProductsLists = await sql<
    {
      listId: string
      cancellingListId: string
      cancelledListId: string
      removedListId: string
    }[]
  >`
    SELECT
      pis.list_id as list_id,
      pis.cancelling_list_id,
      pis.cancelled_list_id,
      pis.removed_list_id
    FROM sale_data_product sip
    JOIN sale s ON s.last_data_product_id = sip.data_product_id
    JOIN product p ON p.product_number = sip.product_number
    JOIN product_integration_smoove pis ON pis.data_id = p.last_data_id
    WHERE s.sale_number = ${saleNumber} AND sip.quantity > 0;
  `

  const smooveContactIdResult = await sql<{smooveContactId: string}[]>`
    SELECT
      smoove_contact_id
    FROM student
    INNER JOIN student_integration_smoove sis ON sis.data_id = student.last_data_id
    WHERE student_number = ${studentNumber}
  `

  const smooveContactId =
    smooveContactIdResult.length > 0 ? smooveContactIdResult[0].smooveContactId : undefined

  if (!smooveContactId) {
    return
  }

  const result = await Promise.allSettled(
    smooveProductsLists.map((smooveProductLists) =>
      smooveIntegration.changeContactLinkedLists(parseInt(smooveContactId), {
        subscribeTo: [parseInt(smooveProductLists.listId)],
        unsubscribeFrom: [
          parseInt(smooveProductLists.cancellingListId),
          parseInt(smooveProductLists.cancelledListId),
          parseInt(smooveProductLists.removedListId),
        ],
      }),
    ),
  )

  for (const [is, res] of Object.entries(result)) {
    const i = parseInt(is)
    if (res.status === 'rejected') {
      logger.error(
        {err: res.reason, courseId: smooveProductsLists[i].listId, i, studentNumber},
        'adding-student-to-smoove-list-failed',
      )
    } else {
      logger.info(
        {courseId: smooveProductsLists[i].listId, i, studentNumber},
        'adding-student-to-smoove-list-succeeded',
      )
    }
  }
}

export async function connectStudentWithAcademyCourses(
  saleNumber: number,
  student: {email: string; name: string; phone: string},
  academyIntegration: AcademyIntegrationService,
  sql: Sql,
  logger: FastifyBaseLogger,
): Promise<void> {
  // Get student info and all academy courses for products in the actual sale
  const courses = await sql<{courseId: string}[]>`
    SELECT DISTINCT
      pac.workshop_id as course_id

    FROM sale_data_product sip
    INNER JOIN sale s ON s.last_data_product_id = sip.data_product_id
    INNER JOIN product p ON p.product_number = sip.product_number
    INNER JOIN product_academy_course pac ON pac.data_id = p.last_data_id
    WHERE s.sale_number = ${saleNumber} AND sip.quantity > 0
    ORDER BY pac.workshop_id
  `

  logger.info({courses}, 'academy-courses-to-connect')

  // This has to be done sequentially because the academy integration does not
  // like concurrent requests for the same student
  for (const {courseId} of courses) {
    try {
      await retry(() => academyIntegration.addStudentToCourse(student, parseInt(courseId)), {
        retries: 5,
        minTimeout: 1000,
        maxTimeout: 5000,
      })
      logger.info({courseId, student: student.email}, 'adding-student-to-academy-course-succeeded')
    } catch (err) {
      logger.error(
        {err, courseId, student: student.email},
        'adding-student-to-academy-course-failed',
      )
    }
  }
}

type SaleWithProvidersResult = {
  saleNumber: number
  email: string | null
  phone: string | null
  smooveContactId: string | null
  products: {
    productNumber: number
    productName: string
    academyCourses: string[] | null
    smooveLists: {
      listId: string | null
      cancelledListId: string | null
      removedListId: string | null
    }
    whatsAppGroups: string[] | null
  }[]
}
