import {test, expect} from '@playwright/test'
import {createStudent} from '@giltayar/carmbo-pages-student/students'
import {
  createCommunityMemberPageModel,
  createCommunityMembersPageModel,
} from '@giltayar/carmbo-pages-community/testkit/page-model/community-member.model'
import {addMember, queryMember} from '../../../src/member-model.ts'
import {createMemberFixture} from '../common/member-fixture.ts'
import {setup} from '../common/setup.ts'

let now = new Date('2026-10-28T10:00:00Z')
const {sql, url} = setup(import.meta.url, {nowService: () => now})
test.beforeEach(() => {
  now = new Date('2026-10-28T10:00:00Z')
})

test('community tabs open the member list and its add and membership links', async ({page}) => {
  const {communityNumber, studentNumber, base} = await createMemberFixture(sql(), now)
  await addMember(communityNumber, studentNumber, now, sql())
  const list = createCommunityMembersPageModel(page)
  await page.goto(new URL(`/communities/${communityNumber}`, url()).href)
  await expect(list.list().locator).toHaveCount(0)
  await expect(list.tabs().details().locator).toHaveAttribute('aria-current', 'page')
  await list.tabs().members().locator.click()
  await expect(page).toHaveURL(new URL(`/communities/${communityNumber}/members`, url()).href)
  await expect(list.tabs().members().locator).toHaveAttribute('aria-current', 'page')
  await expect(createCommunityMemberPageModel(page).roles().locator).toHaveCount(0)
  await expect(list.list().rows().locator).toHaveCount(1)
  await expect(list.list().locator).toContainText('Started registration')
  await expect(list.list().member('Alice Student').locator).toHaveAttribute(
    'href',
    `/students/${studentNumber}`,
  )
  await expect(list.list().membership(studentNumber).locator).toHaveAttribute('href', base)
  await list.add().locator.click()
  await expect(page).toHaveURL(new URL(`/communities/${communityNumber}/members/new`, url()).href)
})

test('member names in the list open student profiles', async ({page}) => {
  const {communityNumber, studentNumber} = await createMemberFixture(sql(), now)
  await addMember(communityNumber, studentNumber, now, sql())
  await page.goto(new URL(`/communities/${communityNumber}/members`, url()).href)
  await createCommunityMembersPageModel(page).list().member('Alice Student').locator.click()
  await expect(page).toHaveURL(new URL(`/students/${studentNumber}`, url()).href)
})

test('ordering follows entry, not edits, with deterministic ties and 50-row pagination', async ({
  page,
  request,
}) => {
  const {communityNumber, studentNumber, base} = await createMemberFixture(sql(), now, 'Old')
  await addMember(communityNumber, studentNumber, now, sql())
  let latestStudent = studentNumber
  for (let i = 0; i < 50; i++) {
    latestStudent = await createStudent(
      {
        names: [{firstName: `Student${i}`, lastName: 'Person'}],
        emails: [`student${i}@example.com`],
      },
      undefined,
      undefined,
      undefined,
      now,
      sql(),
    )
    await addMember(communityNumber, latestStudent, now, sql())
  }
  const list = createCommunityMembersPageModel(page)
  await page.goto(new URL(`/communities/${communityNumber}/members?q=student`, url()).href)
  await expect(list.list().rows().locator).toHaveCount(50)
  await expect(list.list().rows().locator.first()).toHaveAttribute(
    'data-student-number',
    String(latestStudent),
  )
  await list.list().rows().locator.nth(49).scrollIntoViewIfNeeded()
  await expect(list.list().rows().locator).toHaveCount(51)
  await expect(list.list().rows().locator.last()).toContainText('Old Student')
  await expect(list.filter().locator).toHaveValue('student')
  await list.filter().locator.fill('STUDENT49')
  await expect(list.list().rows().locator).toHaveCount(1)
  await expect(list.list().rows().locator).toContainText('Student49 Person')
  await expect(page).toHaveURL(
    new URL(`/communities/${communityNumber}/members?q=STUDENT49`, url()).href,
  )
  await page.reload()
  await expect(list.filter().locator).toHaveValue('STUDENT49')
  await expect(list.list().rows().locator).toHaveCount(1)
  await list.filter().locator.fill('no-matching-student')
  await expect(list.list().rows().locator).toHaveCount(0)
  const original = (await queryMember(communityNumber, studentNumber, sql())).member
  await request.put(new URL(`${base}/roles`, url()).href, {
    form: {expectedHistoryId: original.historyId, poster: 'on', moderator: 'on'},
  })
  expect((await queryMember(communityNumber, studentNumber, sql())).member.entryOrder).toBe(
    original.entryOrder,
  )
  for (const action of ['cancel', 're-add']) {
    const {member} = await queryMember(communityNumber, studentNumber, sql())
    now = new Date(now.getTime() + 1000)
    const response = await request.post(new URL(`${base}/actions`, url()).href, {
      form: {expectedHistoryId: member.historyId, action, reasonText: ''},
    })
    if (action === 're-add') {
      expect(response.headers()['hx-redirect']).toBe(`/communities/${communityNumber}/members`)
    }
  }
  const member = (await queryMember(communityNumber, studentNumber, sql())).member
  expect(member.communityMemberNumber).toBe(original.communityMemberNumber)
  expect(member.poster).toBe(true)
  expect(member.moderator).toBe(true)
  expect(member.entryOrder).not.toBe(original.entryOrder)
  await page.goto(new URL(`/communities/${communityNumber}/members`, url()).href)
  await expect(list.list().rows().locator.first()).toContainText('Old Student')
})

test('missing communities return 404 and archived lists hide the add action', async ({
  page,
  request,
}) => {
  expect((await request.get(new URL('/communities/999/members', url()).href)).status()).toBe(404)
  const {communityNumber, studentNumber, base} = await createMemberFixture(sql(), now)
  await addMember(communityNumber, studentNumber, now, sql())
  await request.delete(
    new URL(`/communities/${communityNumber}?delete-operation=delete`, url()).href,
  )
  await page.goto(new URL(`/communities/${communityNumber}/members`, url()).href)
  const list = createCommunityMembersPageModel(page)
  await expect(list.add().locator).toHaveCount(0)
  await expect(list.list().rows().locator).toHaveCount(1)
  await expect(list.list().membership(studentNumber).locator).toHaveAttribute('href', base)
})
