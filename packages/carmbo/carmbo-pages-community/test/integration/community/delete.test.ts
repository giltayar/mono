import {test, expect, type Page} from '@playwright/test'
import {createCommunityListPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/community-list-page.model'
import {createNewCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-page.model'
import {createUpdateCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/update-community-page.model'
import {setup} from '../common/setup.ts'

const {url, TEST_hooks} = setup(import.meta.url)

test('archiving a community', async ({page}) => {
  const communityListModel = createCommunityListPageModel(page)
  const updateCommunityModel = createUpdateCommunityPageModel(page)

  await createCommunity(page, 'Alpha', 'First community')
  await createCommunity(page, 'Beta', 'Second community')

  TEST_hooks['deleteCommunity'] = () => {
    throw new Error('ouch!')
  }

  await updateCommunityModel.form().deleteButton().locator.click()

  await expect(updateCommunityModel.header().errorBanner().locator).toHaveText(
    'Archiving community error: ouch!',
  )
  await expect(updateCommunityModel.pageTitle().locator).not.toContainText('(archived)')

  delete TEST_hooks['deleteCommunity']

  await updateCommunityModel.form().deleteButton().locator.click()

  await expect(updateCommunityModel.pageTitle().locator).toContainText('(archived)')
  await expect(updateCommunityModel.history().items().locator).toHaveCount(2)
  await expect(updateCommunityModel.history().items().item(0).locator).toContainText('archived')
  await expect(updateCommunityModel.history().items().item(1).locator).toContainText('created')

  const updateForm = updateCommunityModel.form()
  await expect(updateForm.nameInput().locator).toHaveAttribute('readonly', 'true')
  await expect(updateForm.descriptionInput().locator).toHaveAttribute('readonly', 'true')
  await expect(updateForm.nameInput().locator).toHaveValue('Beta')
  await expect(updateForm.descriptionInput().locator).toHaveValue('Second community')
  await expect(updateForm.updateButton().locator).not.toBeVisible()
  await expect(updateForm.discardButton().locator).not.toBeVisible()
  await expect(updateForm.deleteButton().locator).not.toBeVisible()
  await expect(updateForm.restoreButton().locator).toBeVisible()

  await page.goto(new URL('/communities', url()).href)

  const rows = communityListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  await expect(rows.row(0).nameCell().locator).toHaveText('Alpha')

  await communityListModel.search().showArchivedCheckbox().locator.click()

  await expect(rows.locator).toHaveCount(2)
  await expect(communityListModel.search().showArchivedCheckbox().locator).toBeChecked()
  await expect(rows.row(0).nameCell().locator).toHaveText('Beta')
  await expect(rows.row(1).nameCell().locator).toHaveText('Alpha')

  await communityListModel.search().showArchivedCheckbox().locator.click()

  await expect(rows.locator).toHaveCount(1)
  await expect(rows.row(0).nameCell().locator).toHaveText('Alpha')
  await expect(communityListModel.search().showArchivedCheckbox().locator).not.toBeChecked()
})

test('restoring a community', async ({page}) => {
  const communityListModel = createCommunityListPageModel(page)
  const updateCommunityModel = createUpdateCommunityPageModel(page)

  await createCommunity(page, 'Gamma', 'To be restored')

  await updateCommunityModel.form().deleteButton().locator.click()
  await expect(updateCommunityModel.pageTitle().locator).toContainText('(archived)')

  TEST_hooks['restoreCommunity'] = () => {
    throw new Error('ouch!')
  }

  await updateCommunityModel.form().restoreButton().locator.click()

  await expect(updateCommunityModel.header().errorBanner().locator).toHaveText(
    'Restoring community error: ouch!',
  )

  delete TEST_hooks['restoreCommunity']

  await updateCommunityModel.form().restoreButton().locator.click()

  await expect(updateCommunityModel.history().items().locator).toHaveCount(3)
  await expect(updateCommunityModel.history().items().item(0).locator).toContainText('restored')
  await expect(updateCommunityModel.history().items().item(1).locator).toContainText('archived')
  await expect(updateCommunityModel.history().items().item(2).locator).toContainText('created')
  await expect(updateCommunityModel.pageTitle().locator).not.toContainText('(archived)')
  await expect(updateCommunityModel.form().nameInput().locator).not.toHaveAttribute('readonly')
  await expect(updateCommunityModel.form().descriptionInput().locator).toHaveValue('To be restored')

  await page.goto(new URL('/communities', url()).href)

  await expect(communityListModel.list().rows().locator).toHaveCount(1)
  await expect(communityListModel.list().rows().row(0).nameCell().locator).toHaveText('Gamma')
})

async function createCommunity(page: Page, name: string, description: string) {
  const newCommunityModel = createNewCommunityPageModel(page)
  const updateCommunityModel = createUpdateCommunityPageModel(page)

  await page.goto(new URL('/communities/new', url()).href)
  await newCommunityModel.form().nameInput().locator.fill(name)
  await newCommunityModel.form().descriptionInput().locator.fill(description)
  await newCommunityModel.form().createButton().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)
}
