import type {Sql} from 'postgres'
import type {FastifyBaseLogger} from 'fastify'
import type {NowService} from '@giltayar/carmbo-commons/commons/now-service'
import type {ControllerResult} from '@giltayar/carmbo-commons/commons/controller-result'
import {finalHtml, retarget} from '@giltayar/carmbo-commons/commons/controller-result'
import {exceptionToBanner} from '@giltayar/carmbo-commons/layout/banner'
import {createStudent} from '@giltayar/carmbo-pages-student/students'
import {getFixedT} from 'i18next'
import {z} from 'zod'
import {
  ActionSchema,
  addMember,
  assertCommunity,
  availableActions,
  changeMember,
  listMembers,
  MemberError,
  queryMember,
  searchStudents,
  studentChoice,
} from './member-model.ts'
import {historyToView, memberToView, viewToRoles} from './member-view-model-mapping.ts'
import {
  renderAddMemberPage,
  renderMemberPage,
  renderMemberStudentDialog,
  renderMemberStudentResults,
  renderMemberStudentSelection,
} from './view/member.ts'
import {renderMembersPage} from './view/members.ts'
import type {
  MemberActionView,
  MemberRolesView,
  NewMemberStudentView,
  NewMemberView,
  StudentChoiceView,
} from './view/member-model.ts'

const t = getFixedT(null, 'community')

export type MemberServices = {
  nowService: NowService
  smooveIntegration?: Parameters<typeof createStudent>[2]
  ravmesserIntegration?: Parameters<typeof createStudent>[3]
}
type Options = MemberServices & {logger: FastifyBaseLogger}

function localizedError(error: unknown): unknown {
  if (error instanceof MemberError) return new Error(t(`members.errors.${error.code}`))
  if (error instanceof z.ZodError) return new Error(t('members.errors.invalidInput'))
  if (
    error instanceof Error &&
    error.message === 'Email or phone number already exists for another student'
  ) {
    return new Error(t('members.errors.studentDuplicate'))
  }
  return error
}

function readError(error: unknown): ControllerResult {
  if (!(error instanceof MemberError)) throw error
  return {
    status: error.code === 'notFound' ? 404 : 403,
    body: t(`members.errors.${error.code}`),
  }
}

export async function showMembers(
  communityNumber: number,
  {query, page}: {query: string; page: number},
  sql: Sql,
): Promise<ControllerResult> {
  try {
    const community = await assertCommunity(communityNumber, sql)
    return finalHtml(
      renderMembersPage({
        communityNumber,
        communityName: community.name,
        readOnly: community.archived,
        members: (await listMembers(communityNumber, {query, page}, sql)).map(memberToView),
        query,
        page,
      }),
    )
  } catch (error) {
    return readError(error)
  }
}

export async function showAddMember(
  communityNumber: number,
  sql: Sql,
  failure?: {error: unknown; view: NewMemberView; selected?: StudentChoiceView},
): Promise<ControllerResult> {
  try {
    const community = await assertCommunity(communityNumber, sql, {writable: true})
    return finalHtml(
      renderAddMemberPage({
        communityNumber,
        communityName: community.name,
        view: failure?.view,
        selected: failure?.selected,
        banner: failure
          ? exceptionToBanner(t('members.errors.operation'), localizedError(failure.error))
          : undefined,
      }),
    )
  } catch (error) {
    return readError(error)
  }
}

export async function showMemberStudentResults(
  communityNumber: number,
  query: string,
  sql: Sql,
): Promise<ControllerResult> {
  try {
    await assertCommunity(communityNumber, sql, {writable: true})
    return finalHtml(renderMemberStudentResults(communityNumber, await searchStudents(query, sql)))
  } catch (error) {
    return readError(error)
  }
}

function studentNumberFromInput(input: string): number {
  const valid = z
    .string()
    .trim()
    .regex(/^[1-9]\d*(?::.*)?$/)
    .parse(input)
  return z
    .number()
    .int()
    .positive()
    .parse(Number(valid.split(':')[0]))
}

export async function selectMemberStudent(
  communityNumber: number,
  input: string,
  sql: Sql,
  {logger}: Options,
): Promise<ControllerResult> {
  try {
    await assertCommunity(communityNumber, sql, {writable: true})
    const selected = await studentChoice(studentNumberFromInput(input), sql, true)
    return finalHtml(renderMemberStudentSelection(selected))
  } catch (error) {
    logger.error({err: error}, 'select-community-member-student')
    return retarget(
      finalHtml(
        renderMemberStudentDialog(communityNumber, {
          banner: exceptionToBanner(t('members.errors.operation'), localizedError(error)),
        }),
      ),
      '#member-student-dialog-content',
    )
  }
}

export async function createMemberStudent(
  communityNumber: number,
  student: NewMemberStudentView,
  sql: Sql,
  {nowService, logger, smooveIntegration, ravmesserIntegration}: Options,
): Promise<ControllerResult> {
  try {
    await assertCommunity(communityNumber, sql, {writable: true})
    const valid = z
      .object({
        firstName: z.string().trim().min(1),
        lastName: z.string().trim().min(1),
        email: z.email(),
        phone: z.string(),
      })
      .parse({...student, email: student.email.trim()})
    const studentNumber = await createStudent(
      {
        names: [{firstName: valid.firstName, lastName: valid.lastName}],
        emails: [valid.email],
        phones: valid.phone.trim() ? [valid.phone] : undefined,
      },
      'Created from community membership',
      smooveIntegration,
      ravmesserIntegration,
      nowService(),
      sql,
    )
    return retarget(
      finalHtml(renderMemberStudentSelection(await studentChoice(studentNumber, sql, true))),
      '#member-student-field',
    )
  } catch (error) {
    logger.error({err: error}, 'create-community-member-student')
    if (
      error instanceof MemberError &&
      (error.code === 'notFound' || error.code === 'archivedCommunity')
    )
      return readError(error)
    return finalHtml(
      renderMemberStudentDialog(communityNumber, {
        student,
        banner: exceptionToBanner(t('members.errors.operation'), localizedError(error)),
      }),
    )
  }
}

export async function createMembership(
  communityNumber: number,
  view: NewMemberView,
  sql: Sql,
  {nowService, logger}: Options,
): Promise<ControllerResult> {
  let selected: StudentChoiceView | undefined
  try {
    const studentNumber = studentNumberFromInput(view.studentNumber)
    selected = await studentChoice(studentNumber, sql, true)
    await addMember(communityNumber, studentNumber, nowService(), sql, viewToRoles(view))
    return {htmxRedirect: `/communities/${communityNumber}/members/${studentNumber}`}
  } catch (error) {
    logger.error({err: error}, 'add-community-member')
    return showAddMember(communityNumber, sql, {error, view, selected})
  }
}

export async function showMember(
  communityNumber: number,
  studentNumber: number,
  sql: Sql,
  historyId?: string,
  failure?: {error: unknown; rolesView?: MemberRolesView; actionView?: MemberActionView},
): Promise<ControllerResult> {
  try {
    const community = await assertCommunity(communityNumber, sql)
    const {member, history, currentHistoryId} = await queryMember(
      communityNumber,
      studentNumber,
      sql,
      historyId,
    )
    return finalHtml(
      renderMemberPage(
        {
          communityNumber,
          communityName: community.name,
          historical: !!historyId,
          readOnly: community.archived || !!historyId,
          currentHistoryId,
          member: memberToView(member),
          history: historyToView(history),
          actions: availableActions(member),
        },
        {
          ...failure,
          banner: failure
            ? exceptionToBanner(t('members.errors.operation'), localizedError(failure.error))
            : undefined,
        },
      ),
    )
  } catch (error) {
    return readError(error)
  }
}

export async function updateMembership(
  communityNumber: number,
  studentNumber: number,
  view: MemberRolesView | MemberActionView,
  sql: Sql,
  {nowService, logger}: Options,
): Promise<ControllerResult> {
  try {
    const change =
      'action' in view
        ? {action: ActionSchema.parse(view.action), reasonText: view.reasonText}
        : {roles: viewToRoles(view)}
    await changeMember(
      communityNumber,
      studentNumber,
      view.expectedHistoryId,
      change,
      nowService(),
      sql,
    )
    const reentry = 'action' in view && ['re-add', 'unblock-and-re-add'].includes(view.action)
    return {
      htmxRedirect: `/communities/${communityNumber}/members${reentry ? '' : `/${studentNumber}`}`,
    }
  } catch (error) {
    logger.error({err: error}, 'update-community-member')
    return showMember(communityNumber, studentNumber, sql, undefined, {
      error,
      ...('action' in view ? {actionView: view} : {rolesView: view}),
    })
  }
}
