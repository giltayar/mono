import {test, expect} from '@playwright/test'
import {createStudentListPageModel} from '../page-model/student-list-page.model.ts'
import {createNewStudentPageModel} from '../page-model/new-student-page.model.ts'
import {createUpdateStudentPageModel} from '../page-model/update-student-page.model.ts'
import {setup} from './setup.ts'

const {url} = setup(import.meta.url)

test('create student then update her', async ({page}) => {
  await page.goto(url().href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  await studentListModel.createNewStudentButton().locator.click()

  await page.waitForURL(newStudentModel.urlRegex)

  await expect(newStudentModel.pageTitle().locator).toHaveText('New Student')
  // Fill the new student form
  const newForm = newStudentModel.form()
  await newForm.names().firstNameInput(0).locator.fill('John')
  await newForm.names().lastNameInput(0).locator.fill('Doe')
  await newForm.emails().emailInput(0).locator.fill('john.doe@example.com')
  await newForm.phones().phoneInput(0).locator.fill('1234567890')
  await newForm.birthdayInput().locator.fill('2000-01-01')
  await newForm.facebookNames().facebookNameInput(0).locator.fill('johnfb')

  // Save the student
  await newForm.createButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateStudentModel.urlRegex)

  const studentNumber = new URL(await page.url()).pathname.split('/').at(-1)

  await expect(updateStudentModel.pageTitle().locator).toHaveText(`Update Student ${studentNumber}`)

  const updateForm = updateStudentModel.form()
  await expect(updateForm.names().firstNameInput(0).locator).toHaveValue('John')
  await expect(updateForm.names().lastNameInput(0).locator).toHaveValue('Doe')
  await expect(updateForm.emails().emailInput(0).locator).toHaveValue('john.doe@example.com')
  await expect(updateForm.phones().phoneInput(0).locator).toHaveValue('1234567890')
  await expect(updateForm.birthdayInput().locator).toHaveValue('2000-01-01')

  // Update the student data
  await updateForm.names().firstNameInput(0).locator.fill('Jane')
  await updateForm.names().lastNameInput(0).locator.fill('Smith')
  await updateForm.emails().emailInput(0).locator.fill('jane.smith@example.com')
  await updateForm.phones().phoneInput(0).locator.fill('0987654321')
  await updateForm.birthdayInput().locator.fill('2001-02-02')

  // Save the student and verify data

  await updateForm.updateButton().locator.click()
  await expect(updateForm.names().firstNameInput(0).locator).toHaveValue('Jane')
  await expect(updateForm.names().lastNameInput(0).locator).toHaveValue('Smith')
  await expect(updateForm.emails().emailInput(0).locator).toHaveValue('jane.smith@example.com')
  await expect(updateForm.phones().phoneInput(0).locator).toHaveValue('0987654321')
  await expect(updateForm.birthdayInput().locator).toHaveValue('2001-02-02')

  // Back to list
  await page.goto(url().href)

  // Check that the student appears in the list
  const rows = studentListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = studentListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Jane Smith')
  await expect(firstRow.emailCell().locator).toHaveText('jane.smith@example.com')
  await expect(firstRow.phoneCell().locator).toHaveText('0987654321')
})

test('discard button', async ({page}) => {
  await page.goto(url().href)
  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  await studentListModel.createNewStudentButton().locator.click()
  await page.waitForURL(newStudentModel.urlRegex)
  await expect(newStudentModel.pageTitle().locator).toHaveText('New Student')

  const newForm = newStudentModel.form()
  await newForm.names().firstNameInput(0).locator.fill('John')
  await newForm.names().lastNameInput(0).locator.fill('Doe')
  await newForm.emails().trashButton(0).locator.click()

  await newForm.discardButton().locator.click()

  await expect(newForm.names().firstNameInput(0).locator).toHaveValue('')
  await expect(newForm.names().lastNameInput(0).locator).toHaveValue('')
  await expect(newForm.emails().emailInput(0).locator).toHaveValue('')

  await newForm.names().firstNameInput(0).locator.fill('John')
  await newForm.names().lastNameInput(0).locator.fill('Doe')
  await newForm.emails().trashButton(0).locator.click()
  await newForm.phones().trashButton(0).locator.click()
  await newForm.facebookNames().trashButton(0).locator.click()

  await newForm.createButton().locator.click()
  await page.waitForURL(updateStudentModel.urlRegex)

  const updateForm = updateStudentModel.form()
  await expect(updateForm.names().firstNameInput(0).locator).toHaveValue('John')
  await expect(updateForm.names().lastNameInput(0).locator).toHaveValue('Doe')
  await expect(newForm.emails().emailInput(0).locator).not.toBeVisible()

  await updateForm.names().firstNameInput(0).locator.fill('Jane')
  await updateForm.names().lastNameInput(0).locator.fill('Smith')
  await newForm.emails().addButton().locator.click()
  await expect(newForm.emails().emailInput(0).locator).toBeVisible()

  await updateForm.discardButton().locator.click()

  await expect(newForm.names().firstNameInput(0).locator).toHaveValue('John')
  await expect(newForm.names().lastNameInput(0).locator).toHaveValue('Doe')
  await expect(newForm.emails().emailInput(0).locator).not.toBeVisible()
})
