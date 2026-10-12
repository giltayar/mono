import {test, expect} from '@playwright/test'
import {createCommunityListPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/community-list-page.model'
import {createNewCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-page.model'
import {createUpdateCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/update-community-page.model'
import {setup} from '../common/setup.ts'

const {url, TEST_hooks} = setup(import.meta.url)

test('create community then update it', async ({page}) => {
  await page.goto(new URL('/communities', url()).href)

  const communityListModel = createCommunityListPageModel(page)
  const newCommunityModel = createNewCommunityPageModel(page)
  const updateCommunityModel = createUpdateCommunityPageModel(page)

  await communityListModel.createNewCommunityButton().locator.click()
  await page.waitForURL(newCommunityModel.urlRegex)

  await expect(newCommunityModel.pageTitle().locator).toHaveText('New Community')

  const newForm = newCommunityModel.form()
  await expect(newForm.nameInput().locator).toHaveValue('')
  await expect(newForm.descriptionInput().locator).toHaveValue('')
  await newForm.nameInput().locator.fill('Yoga Lovers')
  await newForm.descriptionInput().locator.fill('People who love yoga\nand meditation')

  await newForm.createButton().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)

  const communityNumber = new URL(page.url()).pathname.split('/').at(-1)
  await expect(updateCommunityModel.pageTitle().locator).toHaveText(
    `Update Community ${communityNumber}`,
  )

  const updateForm = updateCommunityModel.form()
  await expect(updateForm.nameInput().locator).toHaveValue('Yoga Lovers')
  await expect(updateForm.descriptionInput().locator).toHaveValue(
    'People who love yoga\nand meditation',
  )
  await expect(updateCommunityModel.history().items().locator).toHaveCount(1)
  await expect(updateCommunityModel.history().items().item(0).locator).toContainText('created')

  await updateForm.nameInput().locator.fill('Pilates Lovers')
  await updateForm.descriptionInput().locator.fill('People who love pilates')
  await updateForm.updateButton().locator.click()

  await expect(updateCommunityModel.history().items().locator).toHaveCount(2)
  await expect(updateCommunityModel.history().items().item(0).locator).toContainText('updated')
  await expect(updateForm.nameInput().locator).toHaveValue('Pilates Lovers')
  await expect(updateForm.descriptionInput().locator).toHaveValue('People who love pilates')

  await page.goto(new URL('/communities', url()).href)

  await expect(communityListModel.list().rows().locator).toHaveCount(1)
  const firstRow = communityListModel.list().rows().row(0)
  await expect(firstRow.idLink().locator).toHaveText(communityNumber!)
  await expect(firstRow.nameCell().locator).toHaveText('Pilates Lovers')
  await expect(firstRow.descriptionCell().locator).toHaveText('People who love pilates')

  await firstRow.idLink().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)
  await expect(updateForm.nameInput().locator).toHaveValue('Pilates Lovers')
})

test('description is optional', async ({page}) => {
  await page.goto(new URL('/communities/new', url()).href)

  const communityListModel = createCommunityListPageModel(page)
  const newCommunityModel = createNewCommunityPageModel(page)
  const updateCommunityModel = createUpdateCommunityPageModel(page)

  await newCommunityModel.form().nameInput().locator.fill('No Description')
  await newCommunityModel.form().createButton().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)

  const updateForm = updateCommunityModel.form()
  await expect(updateForm.nameInput().locator).toHaveValue('No Description')
  await expect(updateForm.descriptionInput().locator).toHaveValue('')

  await updateForm.descriptionInput().locator.fill('Now with a description')
  await updateForm.updateButton().locator.click()
  await expect(updateCommunityModel.history().items().locator).toHaveCount(2)
  await expect(updateForm.descriptionInput().locator).toHaveValue('Now with a description')

  await updateForm.descriptionInput().locator.fill('   ')
  await updateForm.updateButton().locator.click()
  await expect(updateCommunityModel.history().items().locator).toHaveCount(3)
  await expect(updateForm.descriptionInput().locator).toHaveValue('')

  await page.goto(new URL('/communities', url()).href)
  await expect(communityListModel.list().rows().row(0).descriptionCell().locator).toHaveText('')
})

test('discard button', async ({page}) => {
  await page.goto(new URL('/communities/new', url()).href)

  const newCommunityModel = createNewCommunityPageModel(page)
  const updateCommunityModel = createUpdateCommunityPageModel(page)

  const newForm = newCommunityModel.form()
  await newForm.nameInput().locator.fill('To be discarded')
  await newForm.descriptionInput().locator.fill('Also discarded')
  await newForm.discardButton().locator.click()

  await expect(newForm.nameInput().locator).toHaveValue('')
  await expect(newForm.descriptionInput().locator).toHaveValue('')

  await newForm.nameInput().locator.fill('Kept')
  await newForm.descriptionInput().locator.fill('Kept description')
  await newForm.createButton().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)

  const updateForm = updateCommunityModel.form()
  await updateForm.nameInput().locator.fill('Changed')
  await updateForm.descriptionInput().locator.fill('Changed description')
  await updateForm.discardButton().locator.click()

  await expect(updateForm.nameInput().locator).toHaveValue('Kept')
  await expect(updateForm.descriptionInput().locator).toHaveValue('Kept description')
  await expect(updateCommunityModel.history().items().locator).toHaveCount(1)
})

test('creation/update error shows alert and keeps the typed values', async ({page}) => {
  await page.goto(new URL('/communities/new', url()).href)

  const newCommunityModel = createNewCommunityPageModel(page)
  const updateCommunityModel = createUpdateCommunityPageModel(page)

  const newForm = newCommunityModel.form()
  await newForm.nameInput().locator.fill('Runners')
  await newForm.descriptionInput().locator.fill('Morning runners')

  TEST_hooks['createCommunity'] = () => {
    throw new Error('ouch!')
  }

  await newForm.createButton().locator.click()

  await expect(newCommunityModel.header().errorBanner().locator).toHaveText(
    'Creating community error: ouch!',
  )
  await expect(newForm.nameInput().locator).toHaveValue('Runners')
  await expect(newForm.descriptionInput().locator).toHaveValue('Morning runners')
  delete TEST_hooks['createCommunity']

  await newForm.createButton().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)

  const updateForm = updateCommunityModel.form()
  await updateForm.nameInput().locator.fill('Evening Runners')

  TEST_hooks['updateCommunity'] = () => {
    throw new Error('double ouch!')
  }

  await updateForm.updateButton().locator.click()

  await expect(updateCommunityModel.header().errorBanner().locator).toHaveText(
    'Updating community error: double ouch!',
  )
  await expect(updateForm.nameInput().locator).toHaveValue('Evening Runners')
  await expect(updateCommunityModel.history().items().locator).toHaveCount(1)
})
