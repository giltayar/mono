import {test, expect} from '@playwright/test'
import {createNewStudentPageModel} from '../../page-model/students/new-student-page.model.ts'
import {createStudentListPageModel} from '../../page-model/students/student-list-page.model.ts'
import {createUpdateStudentPageModel} from '../../page-model/students/update-student-page.model.ts'
import {setup} from '../common/setup.ts'

const {url} = setup(import.meta.url)

test('create student then update her (e2e)', async ({page}) => {
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
})
