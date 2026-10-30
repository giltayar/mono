import {createNewCommunityMemberPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-member-page.model'
import {test, expect} from '@playwright/test'
import {createStudent} from '@giltayar/carmbo-pages-student/students'
import {
  createCommunityMemberPageModel,
  createCommunityMembersPageModel,
} from '@giltayar/carmbo-pages-community/testkit/page-model/community-member.model'
import {setup} from '../common/setup.ts'
import {createMemberFixture} from '../common/member-fixture.ts'

const now = new Date('2026-10-28T10:00:00Z')
const {sql, url, TEST_hooks} = setup(import.meta.url, {nowService: () => now})

test('create a student in the dialog; failed add preserves selection and chosen roles', async ({
  page,
}) => {
  const {communityNumber} = await createMemberFixture(sql(), now, 'Alice', 'alice@example.com')
  const members = createCommunityMembersPageModel(page)
  const newMember = createNewCommunityMemberPageModel(page)

  await page.goto(new URL(`/communities/${communityNumber}/members/new`, url()).href)

  await newMember.roles().checkbox('Poster').locator.uncheck()
  await newMember.roles().checkbox('Moderator').locator.check()
  await newMember.studentDialog().open().locator.click()
  await newMember.create().open().locator.click()
  await newMember.create().input('firstName').locator.fill('New')
  await newMember.create().input('lastName').locator.fill('Student')
  await newMember.create().input('email').locator.fill('new@example.com')
  await newMember.create().submit().locator.click()

  await expect(newMember.studentDialog().locator).not.toBeVisible()
  await expect(newMember.email().locator).toHaveValue('new@example.com')

  const selectedNumber = Number((await newMember.student().locator.inputValue()).split(':')[0])

  TEST_hooks.writeMemberSnapshot = () => {
    throw new Error('Membership write failed')
  }

  await newMember.submit().locator.click()

  await expect(newMember.error().locator).toContainText('Membership write failed')
  await expect(newMember.student().locator).toHaveValue(`${selectedNumber}: New Student`)
  await expect(newMember.email().locator).toHaveValue('new@example.com')
  await expect(newMember.roles().checkbox('Poster').locator).not.toBeChecked()
  await expect(newMember.roles().checkbox('Moderator').locator).toBeChecked()

  delete TEST_hooks.writeMemberSnapshot

  await newMember.submit().locator.click()
  await expect(page).toHaveURL(
    new URL(`/communities/${communityNumber}/members/${selectedNumber}`, url()).href,
  )

  const memberPage = createCommunityMemberPageModel(page)
  await expect(memberPage.roles().checkbox('Moderator').locator).toBeChecked()
  await expect(memberPage.roles().checkbox('Poster').locator).not.toBeChecked()
  await expect(memberPage.state().field('Email').locator).toHaveText('new@example.com')
  for (const role of ['Live streamer', 'User blocker', 'User approver']) {
    await expect(memberPage.roles().checkbox(role).locator).not.toBeChecked()
  }
  await expect(memberPage.history().items().locator).toHaveCount(1)

  await memberPage.breadcrumb().link('Community').locator.click()
  await expect(members.list().rows().locator).toHaveCount(1)
})

test('student validation and duplicate contact errors retain typed input', async ({page}) => {
  const {communityNumber} = await createMemberFixture(sql(), now, 'Alice', 'alice@example.com')
  const newMember = createNewCommunityMemberPageModel(page)
  await page.goto(new URL(`/communities/${communityNumber}/members/new`, url()).href)

  await newMember.studentDialog().open().locator.click()
  await newMember.create().open().locator.click()
  await newMember.create().input('firstName').locator.fill('Duplicate')
  await newMember.create().input('lastName').locator.fill('Person')
  await newMember.create().input('email').locator.fill('alice@example.com')
  await newMember.create().submit().locator.click()

  await expect(newMember.error().locator).toContainText('Email or phone already belongs')
  await expect(newMember.studentDialog().locator).toBeVisible()
  await expect(newMember.create().input('firstName').locator).toHaveValue('Duplicate')

  await newMember.create().input('firstName').locator.fill(' ')
  await newMember.create().input('email').locator.fill('valid@example.com')
  await newMember.create().submit().locator.click()
  await expect(newMember.error().locator).toContainText(
    'Please check the membership or student details',
  )
  await expect(newMember.create().input('firstName').locator).toHaveValue(' ')
})

test('cancelling the student dialog preserves the add form without creating records', async ({
  page,
}) => {
  const {communityNumber} = await createMemberFixture(sql(), now, 'Alice', 'alice@example.com')
  const members = createCommunityMembersPageModel(page)
  const newMember = createNewCommunityMemberPageModel(page)
  const addUrl = new URL(`/communities/${communityNumber}/members/new`, url()).href
  await page.goto(addUrl)

  await newMember.roles().checkbox('User approver').locator.check()
  await newMember.studentDialog().open().locator.click()
  await expect(newMember.studentDialog().locator).toBeVisible()
  await expect(newMember.search().input().locator).toBeFocused()
  await newMember.studentDialog().cancel().locator.click()
  await expect(newMember.studentDialog().locator).not.toBeVisible()
  await expect(newMember.roles().checkbox('User approver').locator).toBeChecked()
  await newMember.studentDialog().open().locator.click()
  await expect(newMember.studentDialog().locator).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(newMember.studentDialog().locator).not.toBeVisible()
  await expect(page).toHaveURL(addUrl)
  await newMember.cancel().locator.click()
  await expect(members.list().rows().locator).toHaveCount(0)
  await members.add().locator.click()
  await newMember.studentDialog().open().locator.click()
  await newMember.search().input().locator.fill('alice@example.com')
  await newMember.search().submit().locator.click()
  await newMember.search().select('Alice Student').locator.click()
  await expect(newMember.student().locator).toHaveValue(/\d+: Alice Student/)
})

test('duplicate phone validation uses the published student normalization', async ({page}) => {
  const {communityNumber} = await createMemberFixture(sql(), now, 'Alice', 'alice@example.com')
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
  const newMember = createNewCommunityMemberPageModel(page)
  await page.goto(new URL(`/communities/${communityNumber}/members/new`, url()).href)
  await newMember.studentDialog().open().locator.click()
  await newMember.create().open().locator.click()
  for (const [field, value] of [
    ['firstName', 'Duplicate'],
    ['lastName', 'Phone'],
    ['email', 'different@example.com'],
    ['phone', '+972501234567'],
  ] as const) {
    await newMember.create().input(field).locator.fill(value)
  }
  await newMember.create().submit().locator.click()
  await expect(newMember.error().locator).toContainText('Email or phone already belongs')
  await expect(newMember.studentDialog().locator).toBeVisible()
  await expect(newMember.create().input('phone').locator).toHaveValue('+972501234567')
  await newMember.search().input().locator.fill('different@example.com')
  await newMember.search().submit().locator.click()
  await expect(newMember.search().noResults().locator).toBeVisible()
})
