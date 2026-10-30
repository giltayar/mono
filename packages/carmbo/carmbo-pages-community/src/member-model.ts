import type {Sql} from 'postgres'
import {z} from 'zod'
import {TEST_executeHook} from '@giltayar/carmbo-commons/commons/TEST_hooks'
import {sqlTextSearch} from '@giltayar/carmbo-commons/commons/sql-commons'

export const roleNames = [
  'poster',
  'liveStreamer',
  'moderator',
  'userBlocker',
  'userApprover',
] as const

export const RolesSchema = z.object({
  poster: z.boolean(),
  liveStreamer: z.boolean(),
  moderator: z.boolean(),
  userBlocker: z.boolean(),
  userApprover: z.boolean(),
})

export const MemberDataSchema = RolesSchema.extend({
  enteredAt: z.date(),
  entryOrder: z.string().regex(/^[1-9]\d*$/),
  status: z.enum([
    'requested-registration',
    'started-registration',
    'registration-email-sent',
    'registration-failed',
    'registered',
    'cancelled',
    'unregistered',
  ]),
  reasonCode: z
    .enum(['email-sending-failed', 'timeout', 'self', 'removed', 'blocked', 'rejected'])
    .nullable(),
  reasonText: z.string().nullable(),
  registrationEmailSentAt: z.date().nullable(),
}).superRefine((state, ctx) => {
  const validReason =
    state.status === 'registration-failed'
      ? state.reasonCode === 'email-sending-failed' || state.reasonCode === 'timeout'
      : state.status === 'unregistered'
        ? ['self', 'removed', 'blocked', 'rejected'].some((code) => code === state.reasonCode)
        : state.reasonCode === null
  const needsEmailDate =
    state.status === 'registration-email-sent' ||
    (state.status === 'registration-failed' && state.reasonCode === 'timeout')
  const forbidsEmailDate =
    state.status === 'requested-registration' || state.status === 'started-registration'
  if (
    !validReason ||
    (needsEmailDate && !state.registrationEmailSentAt) ||
    (forbidsEmailDate && state.registrationEmailSentAt) ||
    (state.registrationEmailSentAt && state.registrationEmailSentAt < state.enteredAt)
  ) {
    ctx.addIssue({code: 'custom', message: 'Invalid membership lifecycle data'})
  }
})

export type Roles = z.infer<typeof RolesSchema>
export type MemberData = z.infer<typeof MemberDataSchema>
export const actionNames = [
  'approve',
  'reject',
  'register',
  'cancel',
  'unregister-self',
  'unregister-removed',
  'block',
  're-add',
  'unblock-and-re-add',
] as const
export const ActionSchema = z.enum(actionNames)
export type MemberAction = z.infer<typeof ActionSchema>
export type MemberOperation =
  | 'add'
  | 'request-registration'
  | 'update-roles'
  | 'registration-email-sent'
  | 'registration-failed'
  | 'unregister'
  | Exclude<MemberAction, 'unregister-self' | 'unregister-removed'>

export type MemberErrorCode =
  | 'notFound'
  | 'archivedCommunity'
  | 'archivedStudent'
  | 'duplicate'
  | 'stale'
  | 'invalidAction'
  | 'invalidInput'

export class MemberError extends Error {
  readonly code: MemberErrorCode
  constructor(code: MemberErrorCode) {
    super(code)
    this.code = code
  }
}

export interface StudentChoice {
  studentNumber: number
  name: string
  email: string
}

export interface Member extends MemberData, StudentChoice {
  communityMemberNumber: number
  historyId: string
}

export interface MemberHistory {
  historyId: string
  timestamp: Date
  operation: MemberOperation
  operationReason: string | null
}

export function availableActions(state: MemberData): MemberAction[] {
  const actions: MemberAction[] = []
  if (state.status === 'unregistered' && state.reasonCode === 'blocked') {
    return ['unblock-and-re-add']
  }
  if (state.status === 'requested-registration') actions.push('approve', 'reject')
  if (
    ['started-registration', 'registration-email-sent', 'registration-failed'].includes(
      state.status,
    )
  ) {
    actions.push('register')
  }
  if (
    [
      'requested-registration',
      'started-registration',
      'registration-email-sent',
      'registration-failed',
    ].includes(state.status)
  ) {
    actions.push('cancel')
  }
  if (state.status === 'registered') actions.push('unregister-self', 'unregister-removed')
  if (state.status === 'cancelled' || state.status === 'unregistered') actions.push('re-add')
  actions.push('block')
  return actions
}

export function transitionMember(
  current: MemberData,
  action: MemberAction,
  reasonText: string,
  now: Date,
  entryOrder: string,
): MemberData {
  const memberData = MemberDataSchema.parse(current)
  if (!availableActions(memberData).includes(action)) throw new MemberError('invalidAction')
  const next = {...memberData, reasonCode: null, reasonText: reasonText.trim() || null}
  switch (action) {
    case 'approve':
    case 're-add':
    case 'unblock-and-re-add':
      return MemberDataSchema.parse({
        ...next,
        status: 'started-registration',
        registrationEmailSentAt: null,
        ...(action === 'approve' ? {} : {enteredAt: now, entryOrder}),
      })
    case 'reject':
      return MemberDataSchema.parse({...next, status: 'unregistered', reasonCode: 'rejected'})
    case 'register':
      return MemberDataSchema.parse({...next, status: 'registered'})
    case 'cancel':
      return MemberDataSchema.parse({...next, status: 'cancelled'})
    case 'unregister-self':
    case 'unregister-removed':
      return MemberDataSchema.parse({
        ...next,
        status: 'unregistered',
        reasonCode: action === 'unregister-self' ? 'self' : 'removed',
      })
    case 'block':
      return MemberDataSchema.parse({...next, status: 'unregistered', reasonCode: 'blocked'})
  }
}

export async function assertCommunity(
  communityNumber: number,
  sql: Sql,
  {writable = false}: {writable?: boolean} = {},
): Promise<{name: string; archived: boolean}> {
  const rows = await sql<{name: string; archived: boolean}[]>`
    SELECT d.name, h.operation = 'delete' AS archived
    FROM community c JOIN community_history h ON h.id = c.last_history_id
    JOIN community_data d ON d.data_id = h.data_id
    WHERE c.community_number = ${communityNumber}
    ${writable ? sql`FOR UPDATE OF c` : sql``}
  `
  if (!rows.length) throw new MemberError('notFound')
  if (writable && rows[0].archived) throw new MemberError('archivedCommunity')
  return rows[0]
}

export async function studentChoice(
  studentNumber: number,
  sql: Sql,
  writable = false,
): Promise<StudentChoice> {
  const rows = await sql<(StudentChoice & {archived: boolean})[]>`
    SELECT s.student_number, concat(n.first_name, ' ', n.last_name) AS name,
      e.email, h.operation = 'delete' AS archived
    FROM student s JOIN student_history h ON h.id = s.last_history_id
    JOIN student_name n ON n.data_id = h.data_id AND n.item_order = 0
    JOIN student_email e ON e.data_id = h.data_id AND e.item_order = 0
    WHERE s.student_number = ${studentNumber}
    ${writable ? sql`FOR UPDATE OF s` : sql``}
  `
  if (!rows.length) throw new MemberError('notFound')
  if (writable && rows[0].archived) throw new MemberError('archivedStudent')
  return rows[0]
}

export async function searchStudents(query: string, sql: Sql): Promise<StudentChoice[]> {
  if (!query.trim()) return []
  return await sql<StudentChoice[]>`
    SELECT s.student_number, concat(n.first_name, ' ', n.last_name) AS name, e.email
    FROM student s JOIN student_history h ON h.id = s.last_history_id
    JOIN student_search search ON search.data_id = h.data_id
    JOIN student_name n ON n.data_id = h.data_id AND n.item_order = 0
    JOIN student_email e ON e.data_id = h.data_id AND e.item_order = 0
    WHERE h.operation <> 'delete' AND search.searchable_text ${sqlTextSearch(query, sql)}
    ORDER BY s.student_number DESC LIMIT 50
  `
}

function memberSelect(sql: Sql) {
  return sql`
    SELECT m.community_member_number, m.student_number, h.id AS history_id,
      d.entered_at, d.entry_order::text, d.poster, d.live_streamer, d.moderator,
      d.user_blocker, d.user_approver, d.status, d.reason_code, d.reason_text,
      d.registration_email_sent_at, concat(n.first_name, ' ', n.last_name) AS name, e.email
    FROM community_member m
    JOIN community_member_history h ON h.community_member_number = m.community_member_number
    JOIN community_member_data d ON d.data_id = h.data_id
      AND d.community_member_number = m.community_member_number
    JOIN student s ON s.student_number = m.student_number
    JOIN student_history sh ON sh.id = s.last_history_id
    JOIN student_name n ON n.data_id = sh.data_id AND n.item_order = 0
    JOIN student_email e ON e.data_id = sh.data_id AND e.item_order = 0
  `
}

function checkedMember(member: Member): Member {
  return {...member, ...MemberDataSchema.parse(member)}
}

export async function listMembers(
  communityNumber: number,
  {query, page}: {query: string; page: number},
  sql: Sql,
): Promise<Member[]> {
  const rows = await sql<Member[]>`
    ${memberSelect(sql)}
    LEFT JOIN student_search search ON search.data_id = sh.data_id
    WHERE m.community_number = ${communityNumber} AND h.id = m.last_history_id
    ${
      query.trim()
        ? sql`AND concat_ws(' ', m.student_number::text, search.searchable_text,
      d.status, d.reason_code, d.reason_text) ${sqlTextSearch(query, sql)}`
        : sql``
    }
    ORDER BY d.entered_at DESC, d.entry_order DESC LIMIT 50 OFFSET ${page * 50}
  `
  return rows.map(checkedMember)
}

export async function queryMember(
  communityNumber: number,
  studentNumber: number,
  sql: Sql,
  historyId?: string,
): Promise<{member: Member; history: MemberHistory[]; currentHistoryId: string}> {
  const rows = await sql<(Member & {currentHistoryId: string})[]>`
    SELECT selected.*, m.last_history_id AS current_history_id
    FROM (${memberSelect(sql)}
      WHERE m.community_number = ${communityNumber} AND m.student_number = ${studentNumber}
        AND h.id = ${historyId ? sql`${historyId}` : sql`m.last_history_id`}
    ) selected JOIN community_member m USING (community_member_number)
  `
  if (!rows.length) throw new MemberError('notFound')
  const member = checkedMember(rows[0])
  const history = await sql<MemberHistory[]>`
    SELECT id AS history_id, timestamp, operation, operation_reason
    FROM community_member_history
    WHERE community_member_number = ${member.communityMemberNumber}
    ORDER BY timestamp DESC
  `
  return {member, history, currentHistoryId: rows[0].currentHistoryId}
}

async function newEntryOrder(sql: Sql): Promise<string> {
  const [row] = await sql<{value: string}[]>`
    SELECT nextval('community_member_entry_order_seq')::text AS value
  `
  return row.value
}

async function writeSnapshot(
  memberNumber: number,
  state: MemberData,
  operation: MemberOperation,
  now: Date,
  sql: Sql,
): Promise<void> {
  const valid = MemberDataSchema.parse(state)
  const historyId = crypto.randomUUID()
  const dataId = crypto.randomUUID()
  await sql`
    INSERT INTO community_member_data (
      data_id, community_member_number, entered_at, entry_order, poster, live_streamer,
      moderator, user_blocker, user_approver, status, reason_code, reason_text,
      registration_email_sent_at
    ) VALUES (
      ${dataId}, ${memberNumber}, ${valid.enteredAt}, ${valid.entryOrder}, ${valid.poster},
      ${valid.liveStreamer}, ${valid.moderator}, ${valid.userBlocker}, ${valid.userApprover},
      ${valid.status}, ${valid.reasonCode}, ${valid.reasonText}, ${valid.registrationEmailSentAt}
    )
  `
  await TEST_executeHook('writeMemberSnapshot')
  await sql`
    INSERT INTO community_member_history
      (id, community_member_number, data_id, timestamp, operation, operation_reason)
    VALUES (${historyId}, ${memberNumber}, ${dataId}, ${now}, ${operation},
      ${operation === 'update-roles' ? null : valid.reasonText})
  `
  await sql`
    UPDATE community_member SET last_history_id = ${historyId}
    WHERE community_member_number = ${memberNumber}
  `
}

export async function addMember(
  communityNumber: number,
  studentNumber: number,
  now: Date,
  sql: Sql,
  roles: Roles = {
    poster: true,
    liveStreamer: false,
    moderator: false,
    userBlocker: false,
    userApprover: false,
  },
): Promise<void> {
  z.number().int().positive().parse(studentNumber)
  await sql.begin(async (tx) => {
    await assertCommunity(communityNumber, tx, {writable: true})
    await studentChoice(studentNumber, tx, true)
    const [row] = await tx<{communityMemberNumber: number}[]>`
      INSERT INTO community_member (community_number, student_number, last_history_id)
      VALUES (${communityNumber}, ${studentNumber}, ${crypto.randomUUID()})
      ON CONFLICT (community_number, student_number) DO NOTHING
      RETURNING community_member_number
    `
    if (!row) throw new MemberError('duplicate')
    await writeSnapshot(
      row.communityMemberNumber,
      {
        enteredAt: now,
        entryOrder: await newEntryOrder(tx),
        ...RolesSchema.parse(roles),
        status: 'started-registration',
        reasonCode: null,
        reasonText: null,
        registrationEmailSentAt: null,
      },
      'add',
      now,
      tx,
    )
  })
}

export async function changeMember(
  communityNumber: number,
  studentNumber: number,
  expectedHistoryId: string,
  change: {roles: Roles} | {action: MemberAction; reasonText: string},
  now: Date,
  sql: Sql,
): Promise<void> {
  z.uuid().parse(expectedHistoryId)
  await sql.begin(async (tx) => {
    await assertCommunity(communityNumber, tx, {writable: true})
    const {member} = await queryMember(communityNumber, studentNumber, tx)
    if (member.historyId !== expectedHistoryId) throw new MemberError('stale')
    let state: MemberData
    let operation: MemberOperation
    if ('roles' in change) {
      if (member.status === 'unregistered' && member.reasonCode === 'blocked') {
        throw new MemberError('invalidAction')
      }
      state = {...member, ...RolesSchema.parse(change.roles)}
      operation = 'update-roles'
    } else {
      const action = ActionSchema.parse(change.action)
      const reentry = action === 're-add' || action === 'unblock-and-re-add'
      if (reentry) await studentChoice(studentNumber, tx, true)
      state = transitionMember(
        member,
        action,
        change.reasonText,
        now,
        reentry ? await newEntryOrder(tx) : member.entryOrder,
      )
      operation =
        action === 'unregister-self' || action === 'unregister-removed' ? 'unregister' : action
    }
    await writeSnapshot(member.communityMemberNumber, state, operation, now, tx)
  })
}
