import {test, expect} from '@playwright/test'
import {createNewCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-page.model'
import {createUpdateCommunityPageModel} from '@giltayar/carmbo-pages-community/testkit/page-model/update-community-page.model'
import {setup} from '../common/setup.ts'

const {url, sql} = setup(import.meta.url)

test('creating a community with a blank name shows a validation error', async ({page}) => {
  await page.goto(new URL('/communities/new', url()).href)

  const newCommunityModel = createNewCommunityPageModel(page)
  const newForm = newCommunityModel.form()

  await newForm.nameInput().locator.fill('   ')
  await newForm.descriptionInput().locator.fill('A description')
  await newForm.createButton().locator.click()

  await expect(newCommunityModel.header().errorBanner().locator).toHaveText(
    'Creating community error: Name is required',
  )
  await expect(newCommunityModel.pageTitle().locator).toHaveText('New Community')
  await expect(newForm.nameInput().locator).toHaveValue('   ')
  await expect(newForm.descriptionInput().locator).toHaveValue('A description')
  expect(await sql()`SELECT * FROM community`).toHaveLength(0)
})

test('updating a community with a blank name shows a validation error', async ({page}) => {
  await page.goto(new URL('/communities/new', url()).href)

  const newCommunityModel = createNewCommunityPageModel(page)
  const updateCommunityModel = createUpdateCommunityPageModel(page)

  await newCommunityModel.form().nameInput().locator.fill('Swimmers')
  await newCommunityModel.form().createButton().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)

  const updateForm = updateCommunityModel.form()
  await updateForm.nameInput().locator.fill('  ')
  await updateForm.descriptionInput().locator.fill('Updated description')
  await updateForm.updateButton().locator.click()

  await expect(updateCommunityModel.header().errorBanner().locator).toHaveText(
    'Updating community error: Name is required',
  )
  await expect(updateForm.nameInput().locator).toHaveValue('  ')
  await expect(updateForm.descriptionInput().locator).toHaveValue('Updated description')
  await expect(updateCommunityModel.history().items().locator).toHaveCount(1)

  await page.reload()
  await expect(updateForm.nameInput().locator).toHaveValue('Swimmers')
  await expect(updateForm.descriptionInput().locator).toHaveValue('')
})

test('names and descriptions are trimmed by the model', async ({page}) => {
  await page.goto(new URL('/communities/new', url()).href)

  const newCommunityModel = createNewCommunityPageModel(page)
  const updateCommunityModel = createUpdateCommunityPageModel(page)

  await newCommunityModel.form().nameInput().locator.fill('  Cyclists  ')
  await newCommunityModel.form().descriptionInput().locator.fill('  On two wheels  ')
  await newCommunityModel.form().createButton().locator.click()
  await page.waitForURL(updateCommunityModel.urlRegex)

  await expect(updateCommunityModel.form().nameInput().locator).toHaveValue('Cyclists')
  await expect(updateCommunityModel.form().descriptionInput().locator).toHaveValue('On two wheels')
})

test('the server validates even when the browser does not', async ({request}) => {
  const created = await request.post(new URL('/communities', url()).href, {
    form: {name: '', description: 'Bypassing the required attribute'},
  })

  expect(created.status()).toBe(200)
  expect(await created.text()).toContain('Creating community error: Name is required')
  expect(await sql()`SELECT * FROM community`).toHaveLength(0)
})

test('the view schema only accepts string form fields', async ({request}) => {
  const missingName = await request.post(new URL('/communities', url()).href, {
    form: {description: 'No name field'},
  })

  expect(missingName.status()).toBe(400)
  expect(await sql()`SELECT * FROM community`).toHaveLength(0)
})
