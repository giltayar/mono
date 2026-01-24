import {test, expect} from '@playwright/test'
import {createNewStudentPageModel} from '../../page-model/students/new-student-page.model.ts'
import {createUpdateStudentPageModel} from '../../page-model/students/update-student-page.model.ts'
import {createStudentListPageModel} from '../../page-model/students/student-list-page.model.ts'
import {setup} from '../common/setup.ts'

const {url, academyIntegration} = setup(import.meta.url)

test.use({viewport: {width: 1024, height: 1400}})

test('magic links appears with one link', async ({page}) => {
  await page.goto(new URL('/students', url()).href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  // Create a new student with the first enrolled email (will become historical)
  await studentListModel.createNewStudentButton().locator.click()
  await page.waitForURL(newStudentModel.urlRegex)

  const email = 'john.already-enrolled@example.com'

  const newForm = newStudentModel.form()
  await newForm.names().firstNameInput(0).locator.fill('Test')
  await newForm.names().lastNameInput(0).locator.fill('Student')
  await newForm.emails().emailInput(0).locator.fill(email)
  await newForm.phones().phoneInput(0).locator.fill('0541234567')
  await newForm.facebookNames().trashButton(0).locator.click()

  await newForm.createButton().locator.click()
  await page.waitForURL(updateStudentModel.urlRegex)

  await updateStudentModel.magicLink().fetchButton().locator.click()

  const magicLink = updateStudentModel.magicLink()
  await expect(magicLink.singleLink().locator).toHaveText(
    `https://fake-magic-link.com/login?email=${encodeURIComponent(email)}`,
  )

  await expect(magicLink.linksList().locator).not.toBeVisible()
  await expect(magicLink.noLinksMessage().locator).not.toBeVisible()
})

test('magic links appears with no link', async ({page}) => {
  await page.goto(new URL('/students', url()).href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  // Create a new student with the first enrolled email (will become historical)
  await studentListModel.createNewStudentButton().locator.click()
  await page.waitForURL(newStudentModel.urlRegex)

  const email = 'john.not-enrolled@example.com'

  const newForm = newStudentModel.form()
  await newForm.names().firstNameInput(0).locator.fill('Test')
  await newForm.names().lastNameInput(0).locator.fill('Student')
  await newForm.emails().emailInput(0).locator.fill(email)
  await newForm.phones().phoneInput(0).locator.fill('0541234567')
  await newForm.facebookNames().trashButton(0).locator.click()

  await newForm.createButton().locator.click()
  await page.waitForURL(updateStudentModel.urlRegex)

  await updateStudentModel.magicLink().fetchButton().locator.click()

  const magicLink = updateStudentModel.magicLink()
  await expect(magicLink.noLinksMessage().locator).toBeVisible()

  await expect(magicLink.singleLink().locator).not.toBeVisible()
  await expect(magicLink.linksList().locator).not.toBeVisible()
})

test('magic links appear for all enrolled emails including historical ones', async ({page}) => {
  await page.goto(new URL('/students', url()).href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  // Create a new student with the first enrolled email (will become historical)
  await studentListModel.createNewStudentButton().locator.click()
  await page.waitForURL(newStudentModel.urlRegex)

  const newForm = newStudentModel.form()
  await newForm.names().firstNameInput(0).locator.fill('Test')
  await newForm.names().lastNameInput(0).locator.fill('Student')
  await newForm.emails().emailInput(0).locator.fill('john.already-enrolled@example.com')
  await newForm.phones().phoneInput(0).locator.fill('0541234567')
  await newForm.facebookNames().trashButton(0).locator.click()

  await newForm.createButton().locator.click()
  await page.waitForURL(updateStudentModel.urlRegex)

  // Update the student: replace the old email with two new enrolled emails
  const updateForm = updateStudentModel.form()

  // Clear the first email and fill with the first new email
  await updateForm.emails().emailInput(0).locator.fill('jane.already-enrolled@example.com')

  // Add a second email
  await updateForm.emails().addButton().locator.click()
  await updateForm.emails().emailInput(1).locator.fill('bob.already-enrolled@example.com')

  await updateForm.updateButton().locator.click()

  await expect(updateStudentModel.history().items().locator).toHaveCount(2)

  // we need to re-add john, because when we update the main email we also chang the student email in the academy integration
  await academyIntegration().addStudentToCourse(
    {email: 'john.already-enrolled@example.com', name: 'John', phone: '0541234567'},
    1,
  )

  await updateStudentModel.magicLink().fetchButton().locator.click()

  const magicLink = updateStudentModel.magicLink()

  // Verify all three magic links appear (historical + current emails)
  // The order is by timestamp DESC, item_order ASC, so current emails first, then historical
  const expectedEmails = [
    'jane.already-enrolled@example.com',
    'bob.already-enrolled@example.com',
    'john.already-enrolled@example.com',
  ]

  await expect(magicLink.linksList().items().locator).toHaveCount(expectedEmails.length)

  for (let i = 0; i < expectedEmails.length; i++) {
    const email = expectedEmails[i]
    const linkItem = magicLink.linksList().items().item(i)

    await expect(linkItem.locator).toContainText(email)

    await expect(linkItem.link().locator).toHaveAttribute(
      'href',
      `https://fake-magic-link.com/login?email=${encodeURIComponent(email)}`,
    )
  }
})

test('magic links will not appear for emails that have no enrolled courses', async ({page}) => {
  await page.goto(new URL('/students', url()).href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  // Create a new student with the first enrolled email (will become historical)
  await studentListModel.createNewStudentButton().locator.click()
  await page.waitForURL(newStudentModel.urlRegex)

  const newForm = newStudentModel.form()
  await newForm.names().firstNameInput(0).locator.fill('Test')
  await newForm.names().lastNameInput(0).locator.fill('Student')
  await newForm.emails().emailInput(0).locator.fill('john.already-enrolled@example.com')
  await newForm.phones().phoneInput(0).locator.fill('0541234567')
  await newForm.facebookNames().trashButton(0).locator.click()

  await newForm.createButton().locator.click()
  await page.waitForURL(updateStudentModel.urlRegex)

  // Update the student: replace the old email with two new enrolled emails
  const updateForm = updateStudentModel.form()

  // Clear the first email and fill with the first new email
  await updateForm.emails().emailInput(0).locator.fill('jane.already-enrolled@example.com')

  // Add a second email
  await updateForm.emails().addButton().locator.click()
  await updateForm.emails().emailInput(1).locator.fill('bob.already-enrolled@example.com')

  // updating the student will rename thejohn email to the jane email, thus eliminating john
  await updateForm.updateButton().locator.click()

  await expect(updateStudentModel.history().items().locator).toHaveCount(2)

  await updateStudentModel.magicLink().fetchButton().locator.click()

  const magicLink = updateStudentModel.magicLink()

  const expectedEmails = ['jane.already-enrolled@example.com', 'bob.already-enrolled@example.com']

  await expect(magicLink.linksList().items().locator).toHaveCount(expectedEmails.length)

  for (let i = 0; i < expectedEmails.length; i++) {
    const email = expectedEmails[i]
    const linkItem = magicLink.linksList().items().item(i)

    await expect(linkItem.locator).toContainText(email)

    await expect(linkItem.link().locator).toHaveAttribute(
      'href',
      `https://fake-magic-link.com/login?email=${encodeURIComponent(email)}`,
    )
  }
})
