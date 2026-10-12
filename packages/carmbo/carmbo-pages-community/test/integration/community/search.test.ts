import {test, expect} from '@playwright/test'
import {createCommunityListPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/community-list-page.model'
import {createUpdateCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/update-community-page.model'
import type {Sql} from 'postgres'
import {createCommunity} from '../../../src/model.ts'
import {setup} from '../common/setup.ts'

const {url, sql} = setup(import.meta.url)

const FILLER_COUNT = 117

test('searching and paging communities', async ({page}) => {
  test.slow()

  const notableNumbers = await seedCommunities(sql())
  const total = notableNumbers.length + FILLER_COUNT

  await page.goto(new URL('/communities', url()).href)

  const communityListModel = createCommunityListPageModel(page)
  const updateCommunityModel = createUpdateCommunityPageModel(page)
  const rows = communityListModel.list().rows()

  // Pagination: descending order, 50 per page
  await expect(rows.locator).toHaveCount(50)
  await expect(rows.row(0).idLink().locator).toHaveText(String(total))
  await expect(rows.row(0).nameCell().locator).toHaveText(`Filler ${FILLER_COUNT}`)
  await expect(rows.row(49).idLink().locator).toHaveText(String(total - 49))

  await rows.locator.nth(49).scrollIntoViewIfNeeded()
  await expect(rows.locator).toHaveCount(100)

  await rows.locator.nth(99).scrollIntoViewIfNeeded()
  await expect(rows.locator).toHaveCount(total)

  await rows.locator.nth(total - 1).scrollIntoViewIfNeeded()
  await expect(rows.locator).toHaveCount(total)
  await expect(rows.row(total - 1).idLink().locator).toHaveText('1')

  // Search by name
  await communityListModel.search().queryInput().locator.fill('Hikers')
  await expect(rows.locator).toHaveCount(2)
  await expect(rows.row(0).idLink().locator).toHaveText(String(notableNumbers[1]))
  await expect(rows.row(1).idLink().locator).toHaveText(String(notableNumbers[0]))

  // Search by description
  await communityListModel.search().queryInput().locator.fill('uniquephrase')
  await expect(rows.locator).toHaveCount(1)
  await expect(rows.row(0).nameCell().locator).toHaveText('Book Club')
  await expect(rows.row(0).descriptionCell().locator).toContainText('uniquephrase')

  // Search is case-insensitive and LIKE characters are literal
  await communityListModel.search().queryInput().locator.fill('100%')
  await expect(rows.locator).toHaveCount(1)
  await expect(rows.row(0).nameCell().locator).toHaveText('100% Runners')

  // Archived communities are excluded unless "show archived" is checked
  await page.goto(new URL(`/communities/${notableNumbers[0]}`, url()).href)
  await updateCommunityModel.form().deleteButton().locator.click()
  await expect(updateCommunityModel.form().restoreButton().locator).toBeVisible()

  await page.goto(new URL('/communities', url()).href)
  await communityListModel.search().queryInput().locator.fill('hikers')
  await expect(rows.locator).toHaveCount(1)
  await expect(rows.row(0).idLink().locator).toHaveText(String(notableNumbers[1]))

  await communityListModel.search().showArchivedCheckbox().locator.check()
  await expect(rows.locator).toHaveCount(2)
  await expect(rows.row(1).idLink().locator).toHaveText(String(notableNumbers[0]))
})

async function seedCommunities(sql: Sql): Promise<number[]> {
  const now = new Date()
  const notable = [
    {name: 'Mountain Hikers', description: 'Weekend trips'},
    {name: 'City Hikers', description: undefined},
    {name: 'Book Club', description: 'Reading with a uniquephrase in it'},
    {name: '100% Runners', description: 'Never walk'},
  ]
  const notableNumbers: number[] = []

  for (const community of notable) {
    notableNumbers.push(await createCommunity(community, undefined, now, sql))
  }

  for (let i = 1; i <= FILLER_COUNT; ++i) {
    await createCommunity(
      {name: `Filler ${i}`, description: `Filler description ${i}`},
      undefined,
      now,
      sql,
    )
  }

  return notableNumbers
}
