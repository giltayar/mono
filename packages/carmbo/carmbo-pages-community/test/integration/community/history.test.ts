import {test, expect} from '@playwright/test'
import {createNewCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-page.model'
import {createUpdateCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/update-community-page.model'
import {createViewCommunityHistoryPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/view-community-history-page.model'
import {setup} from '../common/setup.ts'

const {url} = setup(import.meta.url)

test('can view history', async ({page}) => {
  await page.goto(new URL('/communities/new', url()).href)

  const newCommunityModel = createNewCommunityPageModel(page)
  const updateCommunityModel = createUpdateCommunityPageModel(page)
  const viewHistoryModel = createViewCommunityHistoryPageModel(page)

  await newCommunityModel.form().nameInput().locator.fill('Version 1')
  await newCommunityModel.form().descriptionInput().locator.fill('Description 1')
  await newCommunityModel.form().createButton().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)

  const updateHistory = updateCommunityModel.history()
  const updateForm = updateCommunityModel.form()

  await expect(updateHistory.items().locator).toHaveCount(1)
  await expect(updateHistory.items().item(0).locator).toContainText('created')

  await updateForm.nameInput().locator.fill('Version 2')
  await updateForm.descriptionInput().locator.fill('Description 2')
  await updateForm.updateButton().locator.click()

  await expect(updateHistory.items().locator).toHaveCount(2)
  await expect(updateHistory.items().item(0).locator).toContainText('updated')
  await expect(updateHistory.items().item(1).locator).toContainText('created')
  await expect(updateHistory.items().item(0).link().locator).not.toBeVisible()

  await updateHistory.items().item(1).link().locator.click()
  await page.waitForURL(viewHistoryModel.urlRegex)

  const historyList = viewHistoryModel.history()
  const historyForm = viewHistoryModel.form()

  await expect(viewHistoryModel.pageTitle().locator).toHaveText(/View Community \d+ \(created\)/)
  await expect(historyList.items().locator).toHaveCount(2)
  await expect(historyList.items().item(1).link().locator).not.toBeVisible()
  await expect(historyForm.nameInput().locator).toHaveValue('Version 1')
  await expect(historyForm.descriptionInput().locator).toHaveValue('Description 1')
  await expect(historyForm.nameInput().locator).toHaveAttribute('readonly', 'true')

  await historyList.items().item(0).link().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)

  await expect(updateCommunityModel.pageTitle().locator).toHaveText(/Update Community \d+/)
  await expect(updateForm.nameInput().locator).toHaveValue('Version 2')
  await expect(updateForm.descriptionInput().locator).toHaveValue('Description 2')
})

test('multiple communities have different histories', async ({page}) => {
  const newCommunityModel = createNewCommunityPageModel(page)
  const updateCommunityModel = createUpdateCommunityPageModel(page)

  await page.goto(new URL('/communities/new', url()).href)
  await newCommunityModel.form().nameInput().locator.fill('First')
  await newCommunityModel.form().createButton().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)
  const firstCommunityUrl = page.url()

  await updateCommunityModel.form().nameInput().locator.fill('First updated')
  await updateCommunityModel.form().updateButton().locator.click()
  await expect(updateCommunityModel.history().items().locator).toHaveCount(2)

  await page.goto(new URL('/communities/new', url()).href)
  await newCommunityModel.form().nameInput().locator.fill('Second')
  await newCommunityModel.form().createButton().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)

  await expect(updateCommunityModel.history().items().locator).toHaveCount(1)
  await expect(updateCommunityModel.history().items().item(0).locator).toContainText('created')

  await page.goto(firstCommunityUrl)
  await expect(updateCommunityModel.history().items().locator).toHaveCount(2)
  await expect(updateCommunityModel.form().nameInput().locator).toHaveValue('First updated')
})

test('a history id of another community is not found', async ({page, request}) => {
  const newCommunityModel = createNewCommunityPageModel(page)
  const updateCommunityModel = createUpdateCommunityPageModel(page)

  await page.goto(new URL('/communities/new', url()).href)
  await newCommunityModel.form().nameInput().locator.fill('First')
  await newCommunityModel.form().createButton().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)
  await updateCommunityModel.form().nameInput().locator.fill('First updated')
  await updateCommunityModel.form().updateButton().locator.click()
  await expect(updateCommunityModel.history().items().locator).toHaveCount(2)
  const firstCommunityHistoryUrl = new URL(
    (await updateCommunityModel.history().items().item(1).link().locator.getAttribute('href'))!,
    url(),
  )

  await page.goto(new URL('/communities/new', url()).href)
  await newCommunityModel.form().nameInput().locator.fill('Second')
  await newCommunityModel.form().createButton().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)
  const secondCommunityNumber = new URL(page.url()).pathname.split('/').at(-1)

  const historyId = firstCommunityHistoryUrl.pathname.split('/').at(-1)
  const response = await request.get(
    new URL(`/communities/${secondCommunityNumber}/by-history/${historyId}`, url()).href,
  )
  expect(response.status()).toBe(404)
})
