import {createNewCommunityMemberPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-member-page.model'
import {test, expect, type Page} from '@playwright/test'
import {
  createCommunityMemberPageModel,
  createCommunityMembersPageModel,
} from '@giltayar/carmbo-pages-community/testkit/page-model/community-member.model'
import {createCommunity} from '../../../src/model.ts'
import {addMember, type MemberData, type MemberOperation} from '../../../src/member-model.ts'
import {createCommunityListPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/community-list-page.model'
import {createUpdateCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/update-community-page.model'
import {createUpdateStudentPageModel} from '@giltayar/carmbo-pages-student/testkit/page-model/update-student-page.model'
import {setup} from '../common/setup.ts'
import {createMemberFixture} from '../common/member-fixture.ts'

let now = new Date('2026-10-28T10:00:00Z')
const {sql, url, TEST_hooks} = setup(import.meta.url, {nowService: () => now})
test.beforeEach(() => {
  now = new Date('2026-10-28T10:00:00Z')
})

async function seedMemberData(
  communityNumber: number,
  studentNumber: number,
  fields: Partial<MemberData>,
  operation: MemberOperation,
) {
  const dataId = crypto.randomUUID()
  const historyId = crypto.randomUUID()

  const [seeded] = await sql()<{communityMemberNumber: number}[]>`
    INSERT INTO community_member_data (
      data_id, community_member_number, entered_at, entry_order, poster, live_streamer,
      moderator, user_blocker, user_approver, status, reason_code, reason_text,
      registration_email_sent_at
    )
    SELECT ${dataId}, m.community_member_number, d.entered_at, d.entry_order,
      ${fields.poster ?? true}, ${fields.liveStreamer ?? false},
      ${fields.moderator ?? false}, ${fields.userBlocker ?? false},
      ${fields.userApprover ?? false}, ${fields.status ?? 'started-registration'},
      ${fields.reasonCode ?? null}, ${fields.reasonText ?? null},
      ${fields.registrationEmailSentAt ?? null}
    FROM community_member m
    JOIN community_member_history h ON h.id = m.last_history_id
    JOIN community_member_data d ON d.data_id = h.data_id
    WHERE m.community_number = ${communityNumber} AND m.student_number = ${studentNumber}
    RETURNING community_member_number
  `
  await sql()`
    INSERT INTO community_member_history
      (id, community_member_number, data_id, timestamp, operation)
    VALUES (${historyId}, ${seeded.communityMemberNumber}, ${dataId}, ${now}, ${operation})
  `
  await sql()`UPDATE community_member SET last_history_id = ${historyId}
    WHERE community_member_number = ${seeded.communityMemberNumber}`
}

async function membershipActions(
  page: Page,
  studentNumber: number,
  actionName: string,
  reasonText = '',
) {
  const memberPage = createCommunityMemberPageModel(page)

  const historyCount = await memberPage.history().items().locator.count()
  now = new Date(now.getTime() + 1000)

  await memberPage.actions().reason().locator.fill(reasonText)
  await memberPage.actions().button(actionName).locator.click()

  await expect(memberPage.history().items().locator).toHaveCount(historyCount + 1)
  await expect(page).toHaveURL(new RegExp(`/members/${studentNumber}$`))
}

test('add an existing student, edit independent roles, and navigate full historical snapshots', async ({
  page,
}) => {
  const {communityNumber, studentNumber, base} = await createMemberFixture(
    sql(),
    now,
    'Alice',
    'alice@example.com',
  )

  const members = createCommunityMembersPageModel(page)
  const newMember = createNewCommunityMemberPageModel(page)
  const memberPage = createCommunityMemberPageModel(page)

  await page.goto(new URL(`/communities/${communityNumber}/members/new`, url()).href)
  await expect(newMember.roles().checkbox('Viewer').locator).toBeChecked()
  await expect(newMember.roles().checkbox('Poster').locator).toBeChecked()

  await newMember.studentDialog().open().locator.click()
  await newMember.search().input().locator.fill('alice@example.com')

  await newMember.search().submit().locator.click()
  await newMember.search().select('Alice Student').locator.click()

  await expect(newMember.studentDialog().locator).not.toBeVisible()
  await expect(newMember.student().locator).toHaveValue(`${studentNumber}: Alice Student`)
  await expect(newMember.email().locator).toHaveValue('alice@example.com')

  await newMember.submit().locator.click()

  await expect(page).toHaveURL(new URL(base, url()).href)
  await expect(memberPage.state().locator).toContainText('Started registration')
  const breadcrumb = memberPage.breadcrumb()
  await expect(breadcrumb.items().locator).toHaveText(['Communities', 'Community', 'Alice Student'])
  await expect(breadcrumb.link('Communities').locator).toHaveAttribute('href', '/communities')
  await expect(breadcrumb.link('Community').locator).toHaveAttribute(
    'href',
    `/communities/${communityNumber}/members`,
  )
  await expect(breadcrumb.current().locator).toHaveText('Alice Student')
  await expect(memberPage.state().labels().locator).toHaveText([
    'Status',
    'Student',
    'Email',
    'Date of entry',
  ])
  await expect(memberPage.state().student('Alice Student').locator).toHaveAttribute(
    'href',
    `/students/${studentNumber}`,
  )
  const entryDate = memberPage.state().entryDate().locator
  await expect(entryDate).toHaveText(now.toLocaleDateString('en-IL'))
  await expect(entryDate).toHaveAttribute('title', now.toLocaleTimeString('en-IL'))
  await expect(memberPage.actions().reason().locator).toHaveValue('')

  const historyDate = memberPage.history().items().item(0).date().locator
  await expect(historyDate).toHaveText(now.toLocaleDateString('he-IL'))
  await expect(historyDate).toHaveAttribute('title', now.toLocaleTimeString('he-IL'))
  await expect(historyDate).toHaveAttribute('datetime', now.toISOString())

  await expect(memberPage.roles().checkbox('Viewer').locator).toBeChecked()
  await expect(memberPage.roles().checkbox('Viewer').locator).toBeDisabled()
  await expect(memberPage.roles().checkbox('Poster').locator).toBeChecked()
  for (const role of ['Live streamer', 'Moderator', 'User blocker', 'User approver']) {
    await expect(memberPage.roles().checkbox(role).locator).not.toBeChecked()
  }

  await memberPage.roles().checkbox('Poster').locator.uncheck()
  await memberPage.roles().checkbox('User approver').locator.check()
  await memberPage.roles().save().locator.click()

  await expect(memberPage.history().items().locator).toHaveCount(2)
  await expect(memberPage.roles().checkbox('Poster').locator).not.toBeChecked()

  await memberPage.actions().button('Mark registered').locator.click()
  await expect(memberPage.state().locator).toContainText('Registered')

  await expect(memberPage.history().items().locator).toHaveCount(3)
  await memberPage.history().link('Added').locator.click()

  await expect(memberPage.historical().locator).toBeVisible()
  await expect(memberPage.history().items().dates().locator).toHaveText(
    Array.from({length: 3}, () => now.toLocaleDateString('he-IL')),
  )
  await expect(memberPage.history().items().item(0).date().locator).toHaveAttribute(
    'title',
    now.toLocaleTimeString('he-IL'),
  )
  await expect(memberPage.roles().checkbox('Poster').locator).toBeChecked()
  await expect(memberPage.roles().checkbox('Poster').locator).toBeDisabled()
  await expect(memberPage.actions().locator).toHaveCount(0)

  await memberPage.current().locator.click()
  await page.waitForURL(new URL(base, url()).href)

  const otherCommunity = await createCommunity({name: 'Other'}, undefined, now, sql())
  await addMember(otherCommunity, studentNumber, now, sql())

  await memberPage.breadcrumb().link('Communities').locator.click()

  await createCommunityListPageModel(page).list().communityNumber(otherCommunity).locator.click()
  await members.tabs().members().locator.click()
  await members.list().membership(studentNumber).locator.click()

  await expect(memberPage.roles().checkbox('Poster').locator).toBeChecked()
  await expect(memberPage.roles().checkbox('User approver').locator).not.toBeChecked()
})

test('invalid student input is rejected without creating a membership', async ({page}) => {
  const {communityNumber} = await createMemberFixture(sql(), now, 'Alice', 'alice@example.com')
  const members = createCommunityMembersPageModel(page)
  const newMember = createNewCommunityMemberPageModel(page)

  const addUrl = new URL(`/communities/${communityNumber}/members/new`, url()).href
  await page.goto(addUrl)
  await newMember.submit().locator.click()
  expect(
    await newMember
      .student()
      .locator.evaluate((input) => (input as HTMLInputElement).validity.valueMissing),
  ).toBe(true)

  for (const studentNumber of ['Alice Student', '1oops', '0']) {
    await newMember.student().locator.fill(studentNumber)
    await Promise.all([
      page.waitForResponse(
        (response) => response.request().method() === 'POST' && response.url() === addUrl,
      ),
      newMember.submit().locator.click(),
    ])
    await expect(newMember.error().locator).toContainText(
      'Please check the membership or student details',
    )
    await expect(newMember.student().locator).toHaveValue(studentNumber)
    await expect(page).toHaveURL(addUrl)
  }
  await newMember.cancel().locator.click()
  await expect(members.list().rows().locator).toHaveCount(0)
})

test('blocked members require explicit unblock, preserving roles and clearing attempt diagnostics', async ({
  page,
}) => {
  const {communityNumber, studentNumber, base} = await createMemberFixture(
    sql(),
    now,
    'Alice',
    'alice@example.com',
  )
  await addMember(communityNumber, studentNumber, now, sql())
  await seedMemberData(
    communityNumber,
    studentNumber,
    {
      status: 'registration-failed',
      reasonCode: 'timeout',
      reasonText: 'Old timeout',
      registrationEmailSentAt: now,
      liveStreamer: true,
      userBlocker: true,
    },
    'registration-failed',
  )

  const memberPage = createCommunityMemberPageModel(page)
  const members = createCommunityMembersPageModel(page)
  const newMember = createNewCommunityMemberPageModel(page)

  await page.goto(new URL(base, url()).href)
  const previousEntry = await memberPage.state().entryDate().locator.getAttribute('datetime')
  await expect(memberPage.state().field('Reason / error text').locator).toHaveText('Old timeout')

  await membershipActions(page, studentNumber, 'Block member', 'Policy violation')
  await expect(memberPage.state().field('Status').locator).toHaveText('Unregistered')
  await expect(memberPage.state().field('Reason').locator).toHaveText('Blocked')
  await expect(memberPage.state().field('Reason / error text').locator).toHaveText(
    'Policy violation',
  )
  await expect(memberPage.actions().button('Re-add member').locator).toHaveCount(0)
  await expect(memberPage.roles().checkbox('Poster').locator).toBeDisabled()
  await expect(memberPage.roles().save().locator).toHaveCount(0)

  await memberPage.breadcrumb().link('Community').locator.click()
  await members.add().locator.click()
  await newMember.student().locator.fill(`${studentNumber}: Alice Student`)
  await newMember.submit().locator.click()
  await expect(newMember.error().locator).toContainText('already has a membership')
  await newMember.cancel().locator.click()
  await members.list().membership(studentNumber).locator.click()
  await membershipActions(page, studentNumber, 'Unblock and re-add')

  await expect(page).toHaveURL(new URL(base, url()).href)
  await expect(memberPage.state().field('Status').locator).toHaveText('Started registration')
  await expect(memberPage.roles().checkbox('Live streamer').locator).toBeChecked()
  await expect(memberPage.roles().checkbox('User blocker').locator).toBeChecked()
  for (const field of ['Reason', 'Reason / error text', 'Registration email sent at']) {
    await expect(memberPage.state().field(field).locator).toHaveCount(0)
  }
  await expect(memberPage.state().entryDate().locator).not.toHaveAttribute(
    'datetime',
    previousEntry!,
  )

  await memberPage.history().link('Registration failed').locator.click()
  await expect(memberPage.historical().locator).toBeVisible()
  await expect(memberPage.state().field('Reason / error text').locator).toHaveText('Old timeout')
  await expect(memberPage.state().field('Reason').locator).toHaveText('Registration timed out')
  await expect(memberPage.state().field('Registration email sent at').locator).toBeVisible()
})

for (const [status, reasonCode, operation] of [
  ['requested-registration', null, 'request-registration'],
  ['registration-email-sent', null, 'registration-email-sent'],
  ['registration-failed', 'email-sending-failed', 'registration-failed'],
  ['registration-failed', 'timeout', 'registration-failed'],
] as const) {
  test(`renders future-produced ${status}/${reasonCode} without email or timeout processing`, async ({
    page,
  }) => {
    const {communityNumber, studentNumber, base} = await createMemberFixture(
      sql(),
      now,
      'Alice',
      'alice@example.com',
    )
    await addMember(communityNumber, studentNumber, now, sql())
    await seedMemberData(
      communityNumber,
      studentNumber,
      {
        status,
        reasonCode,
        reasonText: 'Provider details',
        registrationEmailSentAt: status === 'requested-registration' ? null : now,
      },
      operation,
    )

    await page.goto(new URL(base, url()).href)
    const memberPage = createCommunityMemberPageModel(page)
    await expect(memberPage.state().locator).toContainText('Provider details')
    await expect(memberPage.actions().locator).not.toContainText('Send email')

    if (status === 'requested-registration') {
      await expect(memberPage.state().field('Status').locator).toHaveText('Requested registration')
      await membershipActions(page, studentNumber, 'Approve request')

      await expect(memberPage.state().field('Status').locator).toHaveText('Started registration')
    } else {
      const displayedStatus =
        status === 'registration-email-sent' ? 'Registration email sent' : 'Registration failed'
      await expect(memberPage.state().field('Status').locator).toHaveText(displayedStatus)
      if (reasonCode) {
        await expect(memberPage.state().field('Reason').locator).toHaveText(
          reasonCode === 'timeout' ? 'Registration timed out' : 'Email sending failed',
        )
      }
      now = new Date('2026-11-28T10:00:00Z')

      await page.reload()
      await expect(memberPage.state().field('Status').locator).toHaveText(displayedStatus)
      await expect(memberPage.history().items().locator).toHaveCount(2)
      await membershipActions(page, studentNumber, 'Mark registered')
      await expect(memberPage.state().field('Status').locator).toHaveText('Registered')
    }
  })
}

test('rejection, cancellation, and both unregister reasons are recorded', async ({page}) => {
  const {communityNumber, studentNumber, base} = await createMemberFixture(
    sql(),
    now,
    'Alice',
    'alice@example.com',
  )
  await addMember(communityNumber, studentNumber, now, sql())
  await seedMemberData(
    communityNumber,
    studentNumber,
    {status: 'requested-registration'},
    'request-registration',
  )

  const memberPage = createCommunityMemberPageModel(page)
  await page.goto(new URL(base, url()).href)

  await membershipActions(page, studentNumber, 'Reject request', 'Not eligible')
  await expect(memberPage.state().field('Reason').locator).toHaveText('Registration rejected')
  await expect(memberPage.state().field('Reason / error text').locator).toHaveText('Not eligible')

  await membershipActions(page, studentNumber, 'Re-add member')
  await membershipActions(page, studentNumber, 'Cancel registration')
  await expect(memberPage.state().field('Status').locator).toHaveText('Cancelled')
  for (const [button, reason] of [
    ['Unregister (member request)', 'Left voluntarily'],
    ['Unregister (by you)', 'Removed by backoffice'],
  ]) {
    await membershipActions(page, studentNumber, 'Re-add member')
    await membershipActions(page, studentNumber, 'Mark registered')
    await membershipActions(page, studentNumber, button)
    await expect(memberPage.state().field('Status').locator).toHaveText('Unregistered')
    await expect(memberPage.state().field('Reason').locator).toHaveText(reason)
  }
  await expect(memberPage.history().items().locator).toHaveCount(11)
  await memberPage.history().link('Request rejected').locator.click()
  await expect(memberPage.state().field('Reason / error text').locator).toHaveText('Not eligible')
})

test('a failed edit leaves membership details, roles, and history unchanged', async ({page}) => {
  const {communityNumber, studentNumber, base} = await createMemberFixture(
    sql(),
    now,
    'Alice',
    'alice@example.com',
  )
  await addMember(communityNumber, studentNumber, now, sql())

  const memberPage = createCommunityMemberPageModel(page)
  await page.goto(new URL(base, url()).href)

  const previousDetails = await memberPage.state().locator.innerText()
  const previousHistory = await memberPage.history().locator.innerText()
  await memberPage.roles().checkbox('Poster').locator.uncheck()
  await memberPage.roles().checkbox('Moderator').locator.check()

  TEST_hooks.writeMemberSnapshot = () => {
    throw new Error('Snapshot failure')
  }

  await memberPage.roles().save().locator.click()

  await expect(memberPage.error().locator).toContainText('Snapshot failure')
  await expect(memberPage.history().locator).toHaveText(previousHistory, {useInnerText: true})

  await page.reload()

  await expect(memberPage.state().locator).toHaveText(previousDetails, {useInnerText: true})
  await expect(memberPage.history().locator).toHaveText(previousHistory, {useInnerText: true})
  await expect(memberPage.roles().checkbox('Poster').locator).toBeChecked()
  await expect(memberPage.roles().checkbox('Moderator').locator).not.toBeChecked()
})

test('missing resources and foreign history IDs return 404; archived communities reject writes', async ({
  page,
  context,
}) => {
  const first = await createMemberFixture(sql(), now, 'Alice', 'alice@example.com')
  const second = await createMemberFixture(sql(), now, 'Bob', 'bob@example.com')
  await addMember(first.communityNumber, first.studentNumber, now, sql())
  await addMember(second.communityNumber, second.studentNumber, now, sql())

  const memberPage = createCommunityMemberPageModel(page)
  await page.goto(new URL(first.base, url()).href)
  await memberPage.roles().checkbox('Moderator').locator.check()
  await memberPage.roles().save().locator.click()
  await expect(memberPage.history().items().locator).toHaveCount(2)

  const historicalPath = await memberPage.history().link('Added').locator.getAttribute('href')
  const foreignHistoryId = historicalPath!.split('/').at(-1)
  for (const path of [
    '/communities/999/members/new',
    `/communities/${first.communityNumber}/members/999`,
    `${second.base}/by-history/${foreignHistoryId}`,
    `/communities/${first.communityNumber}/members/${second.studentNumber}`,
  ]) {
    expect((await page.goto(new URL(path, url()).href))?.status()).toBe(404)
  }

  const editPage = await context.newPage()
  await editPage.goto(new URL(first.base, url()).href)
  const staleDetail = createCommunityMemberPageModel(editPage)
  await staleDetail.roles().checkbox('Poster').locator.uncheck()

  const addPage = await context.newPage()
  await addPage.goto(new URL(`/communities/${first.communityNumber}/members`, url()).href)

  const staleAdd = createNewCommunityMemberPageModel(addPage)
  await createCommunityMembersPageModel(addPage).add().locator.click()
  await staleAdd.student().locator.fill(`${second.studentNumber}: Bob Student`)

  const createPage = await context.newPage()
  await createPage.goto(new URL(`/communities/${first.communityNumber}/members`, url()).href)
  const staleCreate = createNewCommunityMemberPageModel(createPage)
  await createCommunityMembersPageModel(createPage).add().locator.click()

  await staleCreate.studentDialog().open().locator.click()
  await staleCreate.create().open().locator.click()
  await staleCreate.create().input('firstName').locator.fill('Forbidden')
  await staleCreate.create().input('lastName').locator.fill('Person')
  await staleCreate.create().input('email').locator.fill('forbidden@example.com')

  await page.goto(new URL('/communities', url()).href)
  await createCommunityListPageModel(page)
    .list()
    .communityNumber(first.communityNumber)
    .locator.click()
  const community = createUpdateCommunityPageModel(page)
  await community.form().deleteButton().locator.click()

  await expect(community.pageTitle().locator).toContainText('(archived)')

  const members = createCommunityMembersPageModel(page)
  await members.tabs().members().locator.click()
  await members.list().membership(first.studentNumber).locator.click()
  await expect(memberPage.roles().checkbox('Poster').locator).toBeDisabled()
  await expect(memberPage.actions().locator).toHaveCount(0)

  await staleDetail.roles().save().locator.click()
  await expect(staleDetail.error().locator).toContainText('Archived communities are read-only')
  const addResponse = addPage.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/members/new'),
  )
  await staleAdd.submit().locator.click()
  expect((await addResponse).status()).toBe(403)

  const createResponse = createPage.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/members/student-create'),
  )
  await staleCreate.create().submit().locator.click()
  expect((await createResponse).status()).toBe(403)

  await page.reload()
  await expect(memberPage.history().items().locator).toHaveCount(2)
  await expect(memberPage.roles().checkbox('Poster').locator).toBeChecked()
  await expect(memberPage.roles().checkbox('Moderator').locator).toBeChecked()
})

test('archived students are excluded from search and rejected by direct add/re-add', async ({
  page,
}) => {
  const {communityNumber, studentNumber, base} = await createMemberFixture(
    sql(),
    now,
    'Alice',
    'alice@example.com',
  )
  await addMember(communityNumber, studentNumber, now, sql())
  const second = await createCommunity({name: 'Other'}, undefined, now, sql())

  const memberPage = createCommunityMemberPageModel(page)
  const members = createCommunityMembersPageModel(page)
  const newMember = createNewCommunityMemberPageModel(page)

  await page.goto(new URL(base, url()).href)
  await membershipActions(page, studentNumber, 'Cancel registration')

  await memberPage.state().student('Alice Student').locator.click()

  const student = createUpdateStudentPageModel(page)
  await student.form().deleteButton().locator.click()
  await expect(student.pageTitle().locator).toContainText('(archived)')

  await page.goBack()
  await expect(page).toHaveURL(new URL(base, url()).href)
  await memberPage.actions().button('Re-add member').locator.click()

  await expect(memberPage.error().locator).toContainText('Archived students cannot be added')
  await expect(memberPage.state().field('Status').locator).toHaveText('Cancelled')
  await expect(memberPage.history().items().locator).toHaveCount(2)

  await memberPage.breadcrumb().link('Communities').locator.click()
  await createCommunityListPageModel(page).list().communityNumber(second).locator.click()
  await members.tabs().members().locator.click()
  await members.add().locator.click()
  await newMember.studentDialog().open().locator.click()
  await newMember.search().input().locator.fill('alice')
  await newMember.search().submit().locator.click()
  await expect(newMember.search().noResults().locator).toBeVisible()

  await newMember.studentDialog().cancel().locator.click()
  await newMember.student().locator.fill(`${studentNumber}: Alice Student`)
  await newMember.submit().locator.click()
  await expect(newMember.error().locator).toContainText('Archived students cannot be added')

  await newMember.cancel().locator.click()
  await expect(members.list().rows().locator).toHaveCount(0)
})
