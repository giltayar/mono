import {test, expect} from '@playwright/test'
import {createStudent} from '@giltayar/carmbo-pages-student/students'
import {
  createCommunityMemberPageModel,
  createCommunityMembersPageModel,
} from '@giltayar/carmbo-pages-community/testkit/page-model/community-member.model'
import {createCommunityListPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/community-list-page.model'
import {addMember, queryMember} from '../../../src/member-model.ts'
import {createMemberFixture} from '../common/member-fixture.ts'
import {setup} from '../common/setup.ts'

let now = new Date('2026-10-28T10:00:00Z')
const {sql, url} = setup(import.meta.url, {nowService: () => now})
test.beforeEach(() => {
  now = new Date('2026-10-28T10:00:00Z')
})

test('community tabs open the member list and its add and membership links', async ({page}) => {
  const {communityNumber, studentNumber, base} = await createMemberFixture(
    sql(),
    now,
    'Alice',
    'alice@example.com',
  )
  await addMember(communityNumber, studentNumber, now, sql())

  const members = createCommunityMembersPageModel(page)
  const communities = createCommunityListPageModel(page)

  await page.goto(new URL('/communities', url()).href)
  await communities.list().communityNumber(communityNumber).locator.click()
  await expect(members.tabs().details().locator).toHaveAttribute('aria-current', 'page')

  await members.tabs().members().locator.click()
  await expect(page).toHaveURL(new URL(`/communities/${communityNumber}/members`, url()).href)
  await expect(members.tabs().members().locator).toHaveAttribute('aria-current', 'page')
  await expect(members.list().rows().locator).toHaveCount(1)
  await expect(members.list().locator).toContainText('Started registration')
  await expect(members.list().member('Alice Student').locator).toHaveAttribute(
    'href',
    `/students/${studentNumber}`,
  )
  await expect(members.list().membership(studentNumber).locator).toHaveAttribute('href', base)

  await members.add().locator.click()
  await expect(page).toHaveURL(new URL(`/communities/${communityNumber}/members/new`, url()).href)
})

test('member names in the list open student profiles', async ({page}) => {
  const {communityNumber, studentNumber} = await createMemberFixture(
    sql(),
    now,
    'Alice',
    'alice@example.com',
  )
  await addMember(communityNumber, studentNumber, now, sql())

  const members = createCommunityMembersPageModel(page)
  const communities = createCommunityListPageModel(page)
  await page.goto(new URL('/communities', url()).href)

  await communities.list().communityNumber(communityNumber).locator.click()
  await members.tabs().members().locator.click()
  await members.list().member('Alice Student').locator.click()

  await expect(page).toHaveURL(new URL(`/students/${studentNumber}`, url()).href)
})

test('ordering follows entry, not edits, with deterministic ties and 50-row pagination', async ({
  page,
}) => {
  const {communityNumber, studentNumber} = await createMemberFixture(
    sql(),
    now,
    'Old',
    'old@example.com',
  )
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

  const members = createCommunityMembersPageModel(page)
  const memberPage = createCommunityMemberPageModel(page)
  const communities = createCommunityListPageModel(page)

  await page.goto(new URL('/communities', url()).href)
  await communities.list().communityNumber(communityNumber).locator.click()
  await members.tabs().members().locator.click()
  await members.filter().locator.fill('student')
  await expect(page).toHaveURL(
    new URL(`/communities/${communityNumber}/members?q=student`, url()).href,
  )
  await expect(members.list().rows().locator).toHaveCount(50)
  await expect(members.list().rows().first().locator).toHaveAttribute(
    'data-student-number',
    String(latestStudent),
  )
  await members.list().rows().row(49).locator.scrollIntoViewIfNeeded()
  await expect(members.list().rows().locator).toHaveCount(51)
  await expect(members.list().rows().last().locator).toContainText('Old Student')
  await expect(members.filter().locator).toHaveValue('student')
  await members.filter().locator.fill('STUDENT49')
  await expect(members.list().rows().locator).toHaveCount(1)
  await expect(members.list().rows().locator).toContainText('Student49 Person')
  await expect(page).toHaveURL(
    new URL(`/communities/${communityNumber}/members?q=STUDENT49`, url()).href,
  )

  await page.reload()
  await expect(members.filter().locator).toHaveValue('STUDENT49')
  await expect(members.list().rows().locator).toHaveCount(1)
  await members.filter().locator.fill('no-matching-student')
  await expect(members.list().rows().locator).toHaveCount(0)
  await members.filter().locator.fill('Old')
  await members.list().membership(studentNumber).locator.click()

  const original = (await queryMember(communityNumber, studentNumber, sql())).member

  await memberPage.roles().checkbox('Poster').locator.check()
  await memberPage.roles().checkbox('Moderator').locator.check()
  await memberPage.roles().save().locator.click()

  await expect(memberPage.history().items().locator).toHaveCount(2)
  expect((await queryMember(communityNumber, studentNumber, sql())).member.entryOrder).toBe(
    original.entryOrder,
  )

  now = new Date(now.getTime() + 1000)
  await memberPage.actions().button('Cancel registration').locator.click()

  await expect(memberPage.state().locator).toContainText('Cancelled')
  now = new Date(now.getTime() + 1000)

  await memberPage.actions().button('Re-add member').locator.click()

  await expect(page).toHaveURL(
    new URL(`/communities/${communityNumber}/members/${studentNumber}`, url()).href,
  )
  await expect(memberPage.state().field('Status').locator).toHaveText('Started registration')
  const member = (await queryMember(communityNumber, studentNumber, sql())).member
  expect(member.communityMemberNumber).toBe(original.communityMemberNumber)
  expect(member.poster).toBe(true)
  expect(member.moderator).toBe(true)
  expect(member.entryOrder).not.toBe(original.entryOrder)
  await memberPage.breadcrumb().link('Community').locator.click()
  await expect(members.list().rows().first().locator).toContainText('Old Student')
})

test('missing communities return 404', async ({request}) => {
  expect((await request.get(new URL('/communities/999/members', url()).href)).status()).toBe(404)
})
