import {test, expect} from '@playwright/test'
import {createStudentListPageModel} from '../../page-model/students/student-list-page.model.ts'
import {createNewStudentPageModel} from '../../page-model/students/new-student-page.model.ts'
import {createUpdateStudentPageModel} from '../../page-model/students/update-student-page.model.ts'
import {setup} from '../common/setup.ts'

const {url} = setup(import.meta.url)

test('create student and update multiple fields', async ({page}) => {
  await page.goto(new URL('/students', url()).href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  await studentListModel.createNewStudentButton().locator.click()

  await page.waitForURL(newStudentModel.urlRegex)

  // Fill the names
  const newForm = newStudentModel.form()
  await newForm.names().firstNameInput(0).locator.fill(' John')
  await newForm.names().lastNameInput(0).locator.fill('Doe ')
  await newForm.names().addButton().locator.click()
  await newForm.names().firstNameInput(1).locator.fill('first2 ')
  await newForm.names().lastNameInput(1).locator.fill(' last2')
  await newForm.names().addButton().locator.click()
  await newForm.names().firstNameInput(2).locator.fill('first3')
  await newForm.names().lastNameInput(2).locator.fill('last3')

  await newForm.names().trashButton(1).locator.click()

  await expect(newForm.names().firstNameInput(0).locator).toHaveValue(' John')
  await expect(newForm.names().lastNameInput(0).locator).toHaveValue('Doe ')
  await expect(newForm.names().firstNameInput(1).locator).toHaveValue('first3')
  await expect(newForm.names().lastNameInput(1).locator).toHaveValue('last3')

  // Fill the emails
  await newForm.emails().emailInput(0).locator.fill('john.doe@example.com')
  await newForm.emails().addButton().locator.click()
  await newForm.emails().emailInput(1).locator.fill('email2@example.com')
  await newForm.emails().addButton().locator.click()

  // Wait for the third email field to appear
  await expect(newForm.emails().emailInput(2).locator).toBeVisible()

  await newForm.emails().emailInput(2).locator.fill(' email3@example.com')
  await newForm.emails().trashButton(1).locator.click()

  await expect(newForm.emails().emailInput(0).locator).toHaveValue('john.doe@example.com')
  await expect(newForm.emails().emailInput(1).locator).toHaveValue('email3@example.com')

  // Fill the phones
  await newForm.phones().phoneInput(0).locator.fill(' 1234567890')
  await newForm.phones().addButton().locator.click()
  await newForm.phones().phoneInput(1).locator.fill('2222222222 ')
  await newForm.phones().addButton().locator.click()

  // Wait for the third phone field to appear
  await expect(newForm.phones().phoneInput(2).locator).toBeVisible()

  await newForm.phones().phoneInput(2).locator.fill('3333333333')
  await newForm.phones().trashButton(1).locator.click()

  await expect(newForm.phones().phoneInput(0).locator).toHaveValue(' 1234567890')
  await expect(newForm.phones().phoneInput(1).locator).toHaveValue('3333333333')

  // Fill the facebook names
  await newForm.facebookNames().facebookNameInput(0).locator.fill('johnfb')
  await newForm.facebookNames().addButton().locator.click()
  await newForm.facebookNames().facebookNameInput(1).locator.fill('fb2')
  await newForm.facebookNames().addButton().locator.click()

  await newForm.facebookNames().facebookNameInput(2).locator.fill('fb3')
  await newForm.facebookNames().trashButton(1).locator.click()

  await expect(newForm.facebookNames().facebookNameInput(0).locator).toHaveValue('johnfb')
  await expect(newForm.facebookNames().facebookNameInput(1).locator).toHaveValue('fb3')

  await newForm.createButton().locator.click()

  await page.waitForURL(updateStudentModel.urlRegex)

  const updateForm = updateStudentModel.form()
  await expect(updateForm.names().firstNameInput(0).locator).toHaveValue('John')
  await expect(updateForm.names().lastNameInput(0).locator).toHaveValue('Doe')
  await expect(updateForm.names().firstNameInput(1).locator).toHaveValue('first3')
  await expect(updateForm.names().lastNameInput(1).locator).toHaveValue('last3')

  await expect(updateForm.emails().emailInput(0).locator).toHaveValue('john.doe@example.com')
  await expect(updateForm.emails().emailInput(1).locator).toHaveValue('email3@example.com')

  await expect(updateForm.phones().phoneInput(0).locator).toHaveValue('1234567890')
  await expect(updateForm.phones().phoneInput(1).locator).toHaveValue('3333333333')

  await expect(updateForm.facebookNames().facebookNameInput(0).locator).toHaveValue('johnfb')
  await expect(updateForm.facebookNames().facebookNameInput(1).locator).toHaveValue('fb3')

  await updateForm.names().addButton().locator.click()
  await updateForm.names().firstNameInput(2).locator.fill('first4')
  await updateForm.names().lastNameInput(2).locator.fill('last4')
  await updateForm.names().trashButton(0).locator.click()

  await updateForm.emails().addButton().locator.click()
  await updateForm.emails().emailInput(2).locator.fill('email4@example.com')
  await updateForm.emails().trashButton(0).locator.click()

  await updateForm.phones().addButton().locator.click()
  await updateForm.phones().phoneInput(2).locator.fill('4444444444')
  await updateForm.phones().trashButton(0).locator.click()

  await updateForm.facebookNames().addButton().locator.click()
  await updateForm.facebookNames().facebookNameInput(2).locator.fill('fb4')
  await updateForm.facebookNames().trashButton(0).locator.click()

  await updateForm.updateButton().locator.click()

  await expect(updateForm.names().firstNameInput(0).locator).toHaveValue('first3')
  await expect(updateForm.names().lastNameInput(0).locator).toHaveValue('last3')
  await expect(updateForm.names().firstNameInput(1).locator).toHaveValue('first4')
  await expect(updateForm.names().lastNameInput(1).locator).toHaveValue('last4')

  await expect(updateForm.emails().emailInput(0).locator).toHaveValue('email3@example.com')
  await expect(updateForm.emails().emailInput(1).locator).toHaveValue('email4@example.com')

  await expect(updateForm.phones().phoneInput(0).locator).toHaveValue('3333333333')
  await expect(updateForm.phones().phoneInput(1).locator).toHaveValue('4444444444')

  await expect(updateForm.facebookNames().facebookNameInput(0).locator).toHaveValue('fb3')
  await expect(updateForm.facebookNames().facebookNameInput(1).locator).toHaveValue('fb4')

  await page.goto(new URL('/students', url()).href)

  const rows = studentListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = studentListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('first3 last3, first4 last4')
  await expect(firstRow.emailCell().locator).toHaveText('email3@example.com, email4@example.com')
  await expect(firstRow.phoneCell().locator).toHaveText('3333333333, 4444444444')
})

test('form validations', async ({page}) => {
  await page.goto(new URL('/students', url()).href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  await studentListModel.createNewStudentButton().locator.click()

  await page.waitForURL(newStudentModel.urlRegex)

  const newForm = newStudentModel.form()
  // Fill no names
  await newForm.createButton().locator.click()

  await expect(page.url()).toMatch(newStudentModel.urlRegex)

  await newForm.names().firstNameInput(0).locator.fill('John')
  await newForm.names().lastNameInput(0).locator.fill('Doe')

  // bad email
  await newForm.emails().emailInput(0).locator.fill('invalid-email')

  await newForm.createButton().locator.click()

  await expect(page.url()).toMatch(newStudentModel.urlRegex)
  await newForm.emails().emailInput(0).locator.fill('valid@email.copm')

  // bad phone
  await newForm.phones().phoneInput(0).locator.fill('invalid-phone')

  await newForm.createButton().locator.click()

  await expect(page.url()).toMatch(newStudentModel.urlRegex)
  await newForm.phones().phoneInput(0).locator.fill('+972-48678.423984')

  // bad facebook name
  await newForm.createButton().locator.click()

  await expect(page.url()).toMatch(newStudentModel.urlRegex)

  await newForm.facebookNames().facebookNameInput(0).locator.fill('valid.fbname')

  await newForm.createButton().locator.click()

  await page.waitForURL(updateStudentModel.urlRegex)
})

test('remove any possible fields', async ({page}) => {
  await page.goto(new URL('/students', url()).href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  await studentListModel.createNewStudentButton().locator.click()

  await page.waitForURL(newStudentModel.urlRegex)

  const newForm = newStudentModel.form()
  await newForm.names().firstNameInput(0).locator.fill('John')
  await newForm.names().lastNameInput(0).locator.fill('Doe')
  await newForm.emails().emailInput(0).locator.fill('john.doe@example.com')

  await newForm.phones().trashButton(0).locator.click()
  await newForm.facebookNames().trashButton(0).locator.click()

  await newForm.createButton().locator.click()

  await page.waitForURL(updateStudentModel.urlRegex)

  const updateForm = updateStudentModel.form()

  await expect(updateForm.updateButton().locator).toBeVisible()

  await expect(updateForm.phones().phoneInput(0).locator).not.toBeVisible()
  await expect(updateForm.facebookNames().facebookNameInput(0).locator).not.toBeVisible()

  await updateForm.phones().addButton().locator.click()
  await updateForm.phones().phoneInput(0).locator.fill('3333333333')

  await updateForm.facebookNames().addButton().locator.click()
  await updateForm.facebookNames().facebookNameInput(0).locator.fill('fb3')

  await updateForm.updateButton().locator.click()

  await expect(page.url()).toMatch(updateStudentModel.urlRegex)

  await expect(updateForm.phones().phoneInput(0).locator).toHaveValue('3333333333')
  await expect(updateForm.facebookNames().facebookNameInput(0).locator).toHaveValue('fb3')
})
