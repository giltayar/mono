import {expect, test} from '@playwright/test'
import {
  createEmailListPageModel,
  createEmailPageModel,
} from '@giltayar/carmbo-pages-email/testkit/page-model/email.model'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'
import {setup} from './common/setup.ts'
import {
  linkEmailToMember,
  now,
  renameCommunity,
  seedEmail,
  seedMemberLink,
} from './common/fixture.ts'

const {sql, url} = setup(import.meta.url)

test('emails navigation opens a read-only empty list', async ({page, request}) => {
  await page.goto(new URL('/jobs', url()).href)
  await createAllPagesPageModel(page).header().menu().emailsMenuItem().locator.click()
  await expect(page).toHaveURL(new URL('/emails', url()).href)
  const model = createEmailListPageModel(page)
  await expect(model.empty().locator).toBeVisible()
  await expect(model.rows().locator).toHaveCount(0)
  expect((await request.post(new URL('/emails', url()).href, {data: {}})).status()).toBe(404)
})

test('renders all statuses and failure diagnostics, including emails with no member', async ({
  page,
}) => {
  const statuses = ['sending', 'retrying', 'delivered', 'success', 'failure'] as const
  for (const status of statuses) {
    await seedEmail(sql(), {
      status,
      errorText: status === 'failure' ? 'Provider rejected <script>alert("error")</script>' : null,
    })
  }
  await page.goto(new URL('/emails', url()).href)
  const list = createEmailListPageModel(page)
  await expect(list.rows().locator).toHaveCount(5)
  for (const text of [
    'Sending',
    'Retrying',
    'Accepted by Resend',
    'Delivery confirmed',
    'Failure',
  ]) {
    await expect(list.table().locator).toContainText(text)
  }
  await expect(list.rows().row(0).cell(3).locator).toHaveText('-')
  await expect(list.rows().row(0).cell(4).locator).toHaveText('-')
  await list.rows().row(0).number().locator.click()
  await expect(createEmailPageModel(page).details().field('Error').locator).toHaveText(
    'Provider rejected <script>alert("error")</script>',
  )
})

test('sorts by creation time first, then consecutive number descending', async ({page}) => {
  const newest = await seedEmail(sql(), {createdAt: new Date('2026-02-01T00:00:00Z')})
  const older = await seedEmail(sql())
  const equalTimeLaterNumber = await seedEmail(sql())
  await page.goto(new URL('/emails', url()).href)
  const rows = createEmailListPageModel(page).rows()
  await expect(rows.locator).toHaveCount(3)
  await expect(rows.row(0).number().locator).toHaveText(String(newest))
  await expect(rows.row(1).number().locator).toHaveText(String(equalTimeLaterNumber))
  await expect(rows.row(2).number().locator).toHaveText(String(older))
})

test('searches recipient, community and student names literally and case-insensitively', async ({
  page,
}) => {
  const member = await seedMemberLink(sql(), {firstName: 'Unique Student', lastName: 'Student'})
  const linked = await seedEmail(sql(), {toEmail: 'linked@example.com'})
  await seedEmail(sql(), {toEmail: 'other@example.com'})
  await seedEmail(sql(), {toEmail: 'literal_address@example.com'})
  await renameCommunity(sql(), member.communityNumber, 'Community 100%_')
  await linkEmailToMember(sql(), {communityNumber: member.communityNumber, emailNumber: linked})
  await page.goto(new URL('/emails', url()).href)
  const model = createEmailListPageModel(page)
  for (const query of ['LINKED@EXAMPLE', 'Community', 'unique student']) {
    await model.search().locator.fill(query)
    await expect(model.rows().locator).toHaveCount(1)
    await expect(model.rows().row(0).number().locator).toHaveText(String(linked))
  }
  await model.search().locator.fill('_address')
  await expect(model.rows().locator).toHaveCount(1)
  await expect(model.rows().row(0).locator).toContainText('literal_address@example.com')
  await model.search().locator.fill('%_')
  await expect(model.rows().locator).toHaveCount(1)
  await expect(model.rows().row(0).number().locator).toHaveText(String(linked))
  await model.search().locator.fill("' OR true --")
  await expect(model.empty().locator).toBeVisible()
})

test('searches the current community name, not a previous one', async ({page}) => {
  const member = await seedMemberLink(sql(), {communityName: 'Old name'})
  const linked = await seedEmail(sql(), {createdAt: now})
  await linkEmailToMember(sql(), {communityNumber: member.communityNumber, emailNumber: linked})
  await renameCommunity(sql(), member.communityNumber, 'New name')
  await page.goto(new URL('/emails', url()).href)
  const model = createEmailListPageModel(page)
  await model.search().locator.fill('New name')
  await expect(model.rows().locator).toHaveCount(1)
  await model.search().locator.fill('Old name')
  await expect(model.empty().locator).toBeVisible()
})

test('retains the search query during infinite scrolling without duplicates', async ({page}) => {
  test.slow()
  for (let index = 0; index < 117; index++) {
    await seedEmail(sql(), {toEmail: `match${index}@example.com`})
  }
  await seedEmail(sql(), {toEmail: 'unrelated@example.com'})
  await page.goto(new URL('/emails?q=match', url()).href)
  const rows = createEmailListPageModel(page).rows()
  await expect(rows.locator).toHaveCount(50)
  await rows.row(49).locator.scrollIntoViewIfNeeded()
  await expect(rows.locator).toHaveCount(100)
  await rows.row(99).locator.scrollIntoViewIfNeeded()
  await expect(rows.locator).toHaveCount(117)
  await rows.row(116).locator.scrollIntoViewIfNeeded()
  await expect(rows.locator).toHaveCount(117)
  const visible = await rows.locator.allTextContents()
  expect(new Set(visible).size).toBe(117)
  expect(visible.every((row) => row.includes('match'))).toBe(true)
})
