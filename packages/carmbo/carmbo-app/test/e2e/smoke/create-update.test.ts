import {test, expect} from '@playwright/test'
import {createNewStudentPageModel} from '../../page-model/students/new-student-page.model.ts'
import {createStudentListPageModel} from '../../page-model/students/student-list-page.model.ts'
import {createUpdateStudentPageModel} from '../../page-model/students/update-student-page.model.ts'
import {setup} from '../common/setup.ts'

const {url, smooveIntegration} = setup(import.meta.url)

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

  expect(
    await smooveIntegration.fetchSmooveContact('john.doe@example.com', {
      by: 'email',
    }),
  ).toMatchObject({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    telephone: '1234567890',
    birthday: new Date('2000-01-01'),
  })

  const studentNumber = new URL(await page.url()).pathname.split('/').at(-1)

  await expect(updateStudentModel.pageTitle().locator).toHaveText(`Update Student ${studentNumber}`)

  const updateForm = updateStudentModel.form()
  await expect(updateForm.names().firstNameInput(0).locator).toHaveValue('John')
  await expect(updateForm.names().lastNameInput(0).locator).toHaveValue('Doe')
  await expect(updateForm.emails().emailInput(0).locator).toHaveValue('john.doe@example.com')
  await expect(updateForm.phones().phoneInput(0).locator).toHaveValue('1234567890')
  await expect(updateForm.birthdayInput().locator).toHaveValue('2000-01-01')

  await updateForm.names().firstNameInput(0).locator.fill('Jane')
  await updateForm.names().lastNameInput(0).locator.fill('Smith')
  await updateForm.emails().emailInput(0).locator.fill('jane.smith@example.com')
  await updateForm.phones().phoneInput(0).locator.fill('0987654321')
  await updateForm.birthdayInput().locator.fill('2001-02-02')

  await updateForm.updateButton().locator.click()

  await expect(updateStudentModel.history().items().locator).toHaveCount(2)

  expect
    .poll(() =>
      smooveIntegration.fetchSmooveContact('jane.smith@example.com', {
        by: 'email',
      }),
    )
    .toMatchObject({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      telephone: '0987654321',
      birthday: new Date('2001-02-02'),
    })

  await updateForm.emails().emailInput(0).locator.fill('john.doe@example.com')

  await updateForm.updateButton().locator.click()

  await expect(updateStudentModel.history().items().locator).toHaveCount(3)
})
