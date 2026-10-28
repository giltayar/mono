import {test, expect, type APIRequestContext} from '@playwright/test'
import {createStudent} from '@giltayar/carmbo-pages-student/students'
import {
  createCommunityMemberPageModel,
  createCommunityMembersPageModel,
} from '@giltayar/carmbo-pages-community/testkit/page-model/community-member.model'
import {createCommunity} from '../../../src/model.ts'
import {
  addMember,
  queryMember,
  type MemberState,
  type MemberOperation,
} from '../../../src/member-model.ts'
import {setup} from '../common/setup.ts'
import {createMemberFixture} from '../common/member-fixture.ts'

let now = new Date('2026-10-28T10:00:00Z')
const {sql, url, TEST_hooks} = setup(import.meta.url, {nowService: () => now})
test.beforeEach(() => {
  now = new Date('2026-10-28T10:00:00Z')
})

async function fixture(name = 'Alice', email = `${name.toLowerCase()}@example.com`) {
  return createMemberFixture(sql(), now, name, email)
}

async function seedState(
  communityNumber: number,
  studentNumber: number,
  fields: Partial<MemberState>,
  operation: MemberOperation,
) {
  const {member} = await queryMember(communityNumber, studentNumber, sql())
  const next = {...member, ...fields}
  const dataId = crypto.randomUUID()
  const historyId = crypto.randomUUID()
  await sql().begin(async (tx) => {
    await tx`
      INSERT INTO community_member_data (
        data_id, community_member_number, entered_at, entry_order, poster, live_streamer,
        moderator, user_blocker, user_approver, status, reason_code, reason_text,
        registration_email_sent_at
      ) VALUES (
        ${dataId}, ${member.communityMemberNumber}, ${next.enteredAt}, ${next.entryOrder},
        ${next.poster}, ${next.liveStreamer}, ${next.moderator}, ${next.userBlocker},
        ${next.userApprover}, ${next.status}, ${next.reasonCode}, ${next.reasonText},
        ${next.registrationEmailSentAt}
      )
    `
    await tx`
      INSERT INTO community_member_history
        (id, community_member_number, data_id, timestamp, operation)
      VALUES (${historyId}, ${member.communityMemberNumber}, ${dataId}, ${now}, ${operation})
    `
    await tx`UPDATE community_member SET last_history_id = ${historyId}
      WHERE community_member_number = ${member.communityMemberNumber}`
  })
}

async function action(
  request: APIRequestContext,
  communityNumber: number,
  studentNumber: number,
  actionName: string,
  reasonText = '',
) {
  const {member} = await queryMember(communityNumber, studentNumber, sql())
  now = new Date(now.getTime() + 1000)
  return request.post(
    new URL(`/communities/${communityNumber}/members/${studentNumber}/actions`, url()).href,
    {
      form: {expectedHistoryId: member.historyId, action: actionName, reasonText},
    },
  )
}

test('add an existing student, edit independent roles, and navigate full historical snapshots', async ({
  page,
}) => {
  const {communityNumber, studentNumber, base} = await fixture()
  const list = createCommunityMembersPageModel(page)
  const detail = createCommunityMemberPageModel(page)
  await page.goto(new URL(`/communities/${communityNumber}/members/new`, url()).href)
  await expect(list.roles().checkbox('Viewer').locator).toBeChecked()
  await expect(list.roles().checkbox('Poster').locator).toBeChecked()
  await list.dialog().open().locator.click()
  await list.search().input().locator.fill('alice@example.com')
  await list.search().submit().locator.click()
  await list.search().select('Alice Student').locator.click()
  await expect(list.dialog().locator).not.toBeVisible()
  await expect(list.student().locator).toHaveValue(`${studentNumber}: Alice Student`)
  await expect(list.email().locator).toHaveValue('alice@example.com')
  await list.submit().locator.click()
  await expect(page).toHaveURL(new URL(base, url()).href)
  await expect(detail.state().locator).toContainText('Started registration')
  const historyDate = detail.history().items().locator.first().getByRole('time')
  await expect(historyDate).toHaveText(now.toLocaleDateString('he-IL'))
  await expect(historyDate).toHaveAttribute('title', now.toLocaleTimeString('he-IL'))
  await expect(historyDate).toHaveAttribute('datetime', now.toISOString())
  await expect(detail.roles().checkbox('Viewer').locator).toBeChecked()
  await expect(detail.roles().checkbox('Viewer').locator).toBeDisabled()
  await expect(detail.roles().checkbox('Poster').locator).toBeChecked()
  for (const role of ['Live streamer', 'Moderator', 'User blocker', 'User approver']) {
    await expect(detail.roles().checkbox(role).locator).not.toBeChecked()
  }
  await detail.roles().checkbox('Poster').locator.uncheck()
  await detail.roles().checkbox('User approver').locator.check()
  await detail.roles().save().locator.click()
  await expect(detail.history().items().locator).toHaveCount(2)
  await expect(detail.roles().checkbox('Poster').locator).not.toBeChecked()
  await detail.actions().button('Mark registered').locator.click()
  await expect(detail.state().locator).toContainText('Registered')
  await expect(detail.history().items().locator).toHaveCount(3)
  await detail.history().link('Added').locator.click()
  await expect(page.getByText('Read-only membership snapshot')).toBeVisible()
  await expect(detail.history().items().locator.getByRole('time')).toHaveText(
    Array.from({length: 3}, () => now.toLocaleDateString('he-IL')),
  )
  await expect(detail.history().items().locator.first().getByRole('time')).toHaveAttribute(
    'title',
    now.toLocaleTimeString('he-IL'),
  )
  await expect(detail.roles().checkbox('Poster').locator).toBeChecked()
  await expect(detail.roles().checkbox('Poster').locator).toBeDisabled()
  await expect(detail.actions().locator).toHaveCount(0)
  await page.getByRole('link', {name: 'Current membership', exact: true}).click()
  await page.waitForURL(new URL(base, url()).href)
  const otherCommunity = await createCommunity({name: 'Other'}, undefined, now, sql())
  await addMember(otherCommunity, studentNumber, now, sql())
  const other = await queryMember(otherCommunity, studentNumber, sql())
  expect(other.member.poster).toBe(true)
  expect(other.member.userApprover).toBe(false)
})

test('membership layout groups details and adapts to narrow screens', async ({page}) => {
  const detail = createCommunityMemberPageModel(page)
  const {communityNumber, studentNumber, base} = await fixture()
  await addMember(communityNumber, studentNumber, now, sql())
  await page.setViewportSize({width: 1280, height: 900})
  await page.goto(new URL(base, url()).href)
  const breadcrumb = page.getByRole('navigation', {name: 'Breadcrumb', exact: true})
  await expect(breadcrumb.getByRole('listitem')).toHaveText([
    'Communities',
    'Community',
    'Alice Student',
  ])
  await expect(breadcrumb.getByRole('link', {name: 'Communities', exact: true})).toHaveAttribute(
    'href',
    '/communities',
  )
  await expect(breadcrumb.getByRole('link', {name: 'Community', exact: true})).toHaveAttribute(
    'href',
    `/communities/${communityNumber}/members`,
  )
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('Alice Student')
  await expect(detail.state().locator.getByRole('term')).toHaveText([
    'Status',
    'Student',
    'Email',
    'Date of entry',
  ])
  await expect(
    detail.state().locator.getByRole('link', {name: 'Alice Student', exact: true}),
  ).toHaveAttribute('href', `/students/${studentNumber}`)
  const entryDate = detail.state().locator.getByRole('time')
  await expect(entryDate).toHaveText(now.toLocaleDateString('en-IL'))
  await expect(entryDate).toHaveAttribute('title', now.toLocaleTimeString('en-IL'))
  await expect(page.getByLabel('Reason (optional)', {exact: true})).toHaveValue('')
  await expect(page.getByRole('button', {name: 'Block member', exact: true})).toHaveClass(
    /btn-outline-danger/,
  )
  const cards = detail.roles().locator.or(detail.actions().locator)
  const [desktopRoles, desktopActions] = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const {x, y} = element.getBoundingClientRect()
      return {x, y}
    }),
  )
  expect(desktopRoles.y).toBe(desktopActions.y)
  expect(desktopRoles.x).toBeLessThan(desktopActions.x)
  await page.setViewportSize({width: 375, height: 812})
  const [mobileRoles, mobileActions] = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const {x, y, right} = element.getBoundingClientRect()
      return {x, y, right}
    }),
  )
  expect(mobileRoles.y).toBeLessThan(mobileActions.y)
  for (const card of [mobileRoles, mobileActions]) {
    expect(card.x).toBeGreaterThanOrEqual(0)
    expect(card.right).toBeLessThanOrEqual(375)
  }
})

test('create a student in the dialog; failed add preserves selection and chosen roles', async ({
  page,
}) => {
  const {communityNumber} = await fixture()
  const list = createCommunityMembersPageModel(page)
  await page.goto(new URL(`/communities/${communityNumber}/members/new`, url()).href)
  await list.roles().checkbox('Poster').locator.uncheck()
  await list.roles().checkbox('Moderator').locator.check()
  await list.dialog().open().locator.click()
  await list.create().open().locator.click()
  await list.create().input('firstName').locator.fill('New')
  await list.create().input('lastName').locator.fill('Student')
  await list.create().input('email').locator.fill('new@example.com')
  await list.create().submit().locator.click()
  await expect(list.dialog().locator).not.toBeVisible()
  await expect(list.email().locator).toHaveValue('new@example.com')
  const selectedNumber = Number((await list.student().locator.inputValue()).split(':')[0])
  expect((await sql()`SELECT * FROM community_member`).length).toBe(0)
  TEST_hooks.writeMemberSnapshot = () => {
    throw new Error('Membership write failed')
  }
  await list.submit().locator.click()
  await expect(page.getByRole('alert')).toContainText('Membership write failed')
  await expect(list.student().locator).toHaveValue(`${selectedNumber}: New Student`)
  await expect(list.email().locator).toHaveValue('new@example.com')
  await expect(list.roles().checkbox('Poster').locator).not.toBeChecked()
  await expect(list.roles().checkbox('Moderator').locator).toBeChecked()
  expect((await sql()`SELECT * FROM community_member`).length).toBe(0)
  expect((await sql()`SELECT * FROM community_member_data`).length).toBe(0)
  expect((await sql()`SELECT * FROM community_member_history`).length).toBe(0)
  delete TEST_hooks.writeMemberSnapshot
  await list.submit().locator.click()
  await expect(page).toHaveURL(
    new URL(`/communities/${communityNumber}/members/${selectedNumber}`, url()).href,
  )
  const detail = createCommunityMemberPageModel(page)
  await expect(detail.roles().checkbox('Moderator').locator).toBeChecked()
  await expect(detail.roles().checkbox('Poster').locator).not.toBeChecked()
  expect((await sql()`SELECT * FROM student`).length).toBe(2)
  expect((await queryMember(communityNumber, selectedNumber, sql())).member).toMatchObject({
    email: 'new@example.com',
    poster: false,
    liveStreamer: false,
    moderator: true,
    userBlocker: false,
    userApprover: false,
  })
})

test('student validation and duplicate contact errors retain typed input', async ({
  page,
  request,
}) => {
  const {communityNumber} = await fixture()
  const list = createCommunityMembersPageModel(page)
  await page.goto(new URL(`/communities/${communityNumber}/members/new`, url()).href)
  await list.dialog().open().locator.click()
  await list.create().open().locator.click()
  await list.create().input('firstName').locator.fill('Duplicate')
  await list.create().input('lastName').locator.fill('Person')
  await list.create().input('email').locator.fill('alice@example.com')
  await list.create().submit().locator.click()
  await expect(page.getByRole('alert')).toContainText('Email or phone already belongs')
  await expect(list.dialog().locator).toBeVisible()
  await expect(list.create().input('firstName').locator).toHaveValue('Duplicate')
  expect((await sql()`SELECT * FROM student`).length).toBe(1)
  const invalid = await request.post(
    new URL(`/communities/${communityNumber}/members/student-create`, url()).href,
    {
      form: {firstName: ' ', lastName: 'Person', email: 'not-an-email', phone: ''},
    },
  )
  expect(await invalid.text()).toContain('Please check the membership or student details')
})

test('cancelling the student dialog preserves the add form without creating records', async ({
  page,
}) => {
  const {communityNumber} = await fixture()
  const list = createCommunityMembersPageModel(page)
  await page.setViewportSize({width: 375, height: 812})
  const addUrl = new URL(`/communities/${communityNumber}/members/new`, url()).href
  await page.goto(addUrl)
  await list.roles().checkbox('User approver').locator.check()
  await list.dialog().open().locator.click()
  await expect(list.dialog().locator).toBeVisible()
  await expect(list.search().input().locator).toBeFocused()
  const dialogBounds = await list.dialog().locator.evaluate((element) => {
    const {x, right} = element.getBoundingClientRect()
    return {x, right}
  })
  expect(dialogBounds.x).toBeGreaterThanOrEqual(0)
  expect(dialogBounds.right).toBeLessThanOrEqual(375)
  await list.dialog().cancel().locator.click()
  await expect(list.dialog().locator).not.toBeVisible()
  await expect(list.roles().checkbox('User approver').locator).toBeChecked()
  await list.dialog().open().locator.click()
  await page.keyboard.press('Escape')
  await expect(list.dialog().locator).not.toBeVisible()
  await expect(page).toHaveURL(addUrl)
  expect((await sql()`SELECT * FROM community_member`).length).toBe(0)
  expect((await sql()`SELECT * FROM student`).length).toBe(1)
})

test('invalid student input is rejected without creating a membership', async ({request}) => {
  const {communityNumber} = await fixture()
  for (const studentNumber of ['', 'Alice Student', '1oops', '0']) {
    const response = await request.post(
      new URL(`/communities/${communityNumber}/members/new`, url()).href,
      {form: {studentNumber, poster: 'on'}},
    )
    expect(response.headers()['hx-redirect']).toBeUndefined()
    expect(await response.text()).toContain('Please check the membership or student details')
  }
  expect((await sql()`SELECT * FROM community_member`).length).toBe(0)
})

test('duplicate phone validation uses the published student normalization', async ({request}) => {
  const {communityNumber} = await fixture()
  await createStudent(
    {
      names: [{firstName: 'Phone', lastName: 'Owner'}],
      emails: ['phone-owner@example.com'],
      phones: ['0501234567'],
    },
    undefined,
    undefined,
    undefined,
    now,
    sql(),
  )
  const response = await request.post(
    new URL(`/communities/${communityNumber}/members/student-create`, url()).href,
    {
      form: {
        firstName: 'Duplicate',
        lastName: 'Phone',
        email: 'different@example.com',
        phone: '+972501234567',
      },
    },
  )
  expect(response.headers()['hx-redirect']).toBeUndefined()
  expect(await response.text()).toContain('Email or phone already belongs')
  expect((await sql()`SELECT * FROM student`).length).toBe(2)
})

test('blocked members require explicit unblock, preserving roles and clearing attempt diagnostics', async ({
  request,
}) => {
  const {communityNumber, studentNumber, base} = await fixture()
  await addMember(communityNumber, studentNumber, now, sql())
  await seedState(
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
  const previous = (await queryMember(communityNumber, studentNumber, sql())).member
  await action(request, communityNumber, studentNumber, 'block', 'Policy violation')
  const invalid = await action(request, communityNumber, studentNumber, 're-add')
  expect(invalid.headers()['hx-redirect']).toBeUndefined()
  expect(await invalid.text()).toContain('This action is not available')
  const blocked = (await queryMember(communityNumber, studentNumber, sql())).member
  const blockedRoles = await request.put(new URL(`${base}/roles`, url()).href, {
    form: {expectedHistoryId: blocked.historyId, poster: 'on'},
  })
  expect(await blockedRoles.text()).toContain('This action is not available')
  const directAdd = await request.post(
    new URL(`/communities/${communityNumber}/members/new`, url()).href,
    {form: {studentNumber: String(studentNumber), poster: 'on'}},
  )
  expect(await directAdd.text()).toContain('already has a membership')
  await action(request, communityNumber, studentNumber, 'unblock-and-re-add')
  const current = (await queryMember(communityNumber, studentNumber, sql())).member
  expect(current.communityMemberNumber).toBe(previous.communityMemberNumber)
  expect(current.liveStreamer).toBe(true)
  expect(current.userBlocker).toBe(true)
  expect(current.reasonCode).toBeNull()
  expect(current.reasonText).toBeNull()
  expect(current.registrationEmailSentAt).toBeNull()
  expect(current.enteredAt.getTime()).toBeGreaterThan(previous.enteredAt.getTime())
  const snapshot = await queryMember(communityNumber, studentNumber, sql(), previous.historyId)
  expect(snapshot.member.reasonText).toBe('Old timeout')
})

for (const [status, reasonCode, operation] of [
  ['requested-registration', null, 'request-registration'],
  ['registration-email-sent', null, 'registration-email-sent'],
  ['registration-failed', 'email-sending-failed', 'registration-failed'],
  ['registration-failed', 'timeout', 'registration-failed'],
] as const) {
  test(`renders future-produced ${status}/${reasonCode} without email or timeout processing`, async ({
    page,
    request,
  }) => {
    const {communityNumber, studentNumber, base} = await fixture()
    await addMember(communityNumber, studentNumber, now, sql())
    await seedState(
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
    const detail = createCommunityMemberPageModel(page)
    await expect(detail.state().locator).toContainText('Provider details')
    await expect(detail.actions().locator).not.toContainText('Send email')
    if (status === 'requested-registration') {
      await action(request, communityNumber, studentNumber, 'approve')
      expect((await queryMember(communityNumber, studentNumber, sql())).member.status).toBe(
        'started-registration',
      )
    } else {
      now = new Date('2026-11-28T10:00:00Z')
      await page.reload()
      expect((await queryMember(communityNumber, studentNumber, sql())).member.status).toBe(status)
      await action(request, communityNumber, studentNumber, 'register')
      expect((await queryMember(communityNumber, studentNumber, sql())).member.status).toBe(
        'registered',
      )
    }
  })
}

test('rejection, cancellation, and both unregister reasons are recorded', async ({request}) => {
  const {communityNumber, studentNumber} = await fixture()
  await addMember(communityNumber, studentNumber, now, sql())
  await seedState(
    communityNumber,
    studentNumber,
    {status: 'requested-registration'},
    'request-registration',
  )
  await action(request, communityNumber, studentNumber, 'reject', 'Not eligible')
  expect((await queryMember(communityNumber, studentNumber, sql())).member.reasonCode).toBe(
    'rejected',
  )
  await action(request, communityNumber, studentNumber, 're-add')
  await action(request, communityNumber, studentNumber, 'cancel')
  expect((await queryMember(communityNumber, studentNumber, sql())).member.status).toBe('cancelled')
  for (const reason of ['self', 'removed']) {
    await action(request, communityNumber, studentNumber, 're-add')
    await action(request, communityNumber, studentNumber, 'register')
    await action(request, communityNumber, studentNumber, `unregister-${reason}`)
    expect((await queryMember(communityNumber, studentNumber, sql())).member.reasonCode).toBe(
      reason,
    )
  }
})

test('duplicate/concurrent adds and conflicting edits never lose history', async ({request}) => {
  const {communityNumber, studentNumber, base} = await fixture()
  const adds = await Promise.all([
    request.post(new URL(`/communities/${communityNumber}/members/new`, url()).href, {
      form: {studentNumber: String(studentNumber), poster: 'on'},
    }),
    request.post(new URL(`/communities/${communityNumber}/members/new`, url()).href, {
      form: {studentNumber: String(studentNumber), poster: 'on'},
    }),
  ])
  expect(adds.filter((response) => response.headers()['hx-redirect'])).toHaveLength(1)
  const {member, history} = await queryMember(communityNumber, studentNumber, sql())
  expect(history).toHaveLength(1)
  const edits = await Promise.all([
    request.put(new URL(`${base}/roles`, url()).href, {
      form: {expectedHistoryId: member.historyId, poster: 'on'},
    }),
    request.put(new URL(`${base}/roles`, url()).href, {
      form: {expectedHistoryId: member.historyId, moderator: 'on'},
    }),
  ])
  expect(edits.filter((response) => response.headers()['hx-redirect'])).toHaveLength(1)
  const stale = edits.find((response) => !response.headers()['hx-redirect'])!
  expect(await stale.text()).toContain('This membership changed')
  expect((await queryMember(communityNumber, studentNumber, sql())).history).toHaveLength(2)
})

test('a failed edit leaves pointers, data, and history unchanged', async ({request}) => {
  const {communityNumber, studentNumber, base} = await fixture()
  await addMember(communityNumber, studentNumber, now, sql())
  const previous = await queryMember(communityNumber, studentNumber, sql())
  TEST_hooks.writeMemberSnapshot = () => {
    throw new Error('Snapshot failure')
  }
  const response = await request.put(new URL(`${base}/roles`, url()).href, {
    form: {expectedHistoryId: previous.member.historyId, poster: 'on'},
  })
  expect(await response.text()).toContain('Snapshot failure')
  const current = await queryMember(communityNumber, studentNumber, sql())
  expect(current).toEqual(previous)
  expect((await sql()`SELECT * FROM community_member_data`).length).toBe(1)
})

test('missing resources and foreign history IDs return 404; archived communities reject writes', async ({
  page,
  request,
}) => {
  const first = await fixture()
  const second = await fixture('Bob')
  await addMember(first.communityNumber, first.studentNumber, now, sql())
  await addMember(second.communityNumber, second.studentNumber, now, sql())
  const firstMember = (await queryMember(first.communityNumber, first.studentNumber, sql())).member
  for (const path of [
    '/communities/999/members/new',
    `/communities/${first.communityNumber}/members/999`,
    `${second.base}/by-history/${firstMember.historyId}`,
    `/communities/${first.communityNumber}/members/${second.studentNumber}`,
  ]) {
    expect((await request.get(new URL(path, url()).href)).status()).toBe(404)
  }
  await request.delete(
    new URL(`/communities/${first.communityNumber}?delete-operation=delete`, url()).href,
  )
  await page.goto(new URL(first.base, url()).href)
  const detail = createCommunityMemberPageModel(page)
  await expect(detail.roles().checkbox('Poster').locator).toBeDisabled()
  await expect(detail.actions().locator).toHaveCount(0)
  const edit = await request.put(new URL(`${first.base}/roles`, url()).href, {
    form: {expectedHistoryId: firstMember.historyId, poster: 'on'},
  })
  expect(await edit.text()).toContain('Archived communities are read-only')
  expect(
    (await queryMember(first.communityNumber, first.studentNumber, sql())).history,
  ).toHaveLength(1)
  expect(
    (
      await request.post(new URL(`/communities/${first.communityNumber}/members/new`, url()).href, {
        form: {studentNumber: String(first.studentNumber), poster: 'on'},
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await request.post(
        new URL(`/communities/${first.communityNumber}/members/student-create`, url()).href,
        {
          form: {firstName: 'Forbidden', lastName: 'Person', email: 'forbidden@example.com'},
        },
      )
    ).status(),
  ).toBe(403)
})

test('archived students are excluded from search and rejected by direct add/re-add', async ({
  request,
}) => {
  const {communityNumber, studentNumber, base} = await fixture()
  await addMember(communityNumber, studentNumber, now, sql())
  await action(request, communityNumber, studentNumber, 'cancel')
  await sql()`UPDATE student_history SET operation = 'delete'
    WHERE id = (SELECT last_history_id FROM student WHERE student_number = ${studentNumber})`
  const search = await request.get(
    new URL(`/communities/${communityNumber}/members/student-search?q=alice`, url()).href,
  )
  expect(await search.text()).toContain('No students found')
  const response = await action(request, communityNumber, studentNumber, 're-add')
  expect(await response.text()).toContain('Archived students cannot be added')
  const second = await createCommunity({name: 'Other'}, undefined, now, sql())
  const add = await request.post(new URL(`/communities/${second}/members/new`, url()).href, {
    form: {studentNumber: String(studentNumber), poster: 'on'},
  })
  expect(await add.text()).toContain('Archived students cannot be added')
  expect((await request.get(new URL(base, url()).href)).status()).toBe(200)
})
