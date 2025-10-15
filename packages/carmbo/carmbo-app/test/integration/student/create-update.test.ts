import {test, expect} from '@playwright/test'
import {createStudentListPageModel} from '../../page-model/students/student-list-page.model.ts'
import {createNewStudentPageModel} from '../../page-model/students/new-student-page.model.ts'
import {createUpdateStudentPageModel} from '../../page-model/students/update-student-page.model.ts'
import {setup} from '../common/setup.ts'
const {url, smooveIntegration, TEST_hooks} = setup(import.meta.url)

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
  await newForm.emails().emailInput(0).locator.fill('John.Doe@example.com')
  await newForm.phones().phoneInput(0).locator.fill('+972-54-6344457')
  await newForm.birthdayInput().locator.fill('2000-01-01')
  await newForm.facebookNames().facebookNameInput(0).locator.fill('johnfb')

  // Save the student
  await newForm.createButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateStudentModel.urlRegex)

  expect(
    await smooveIntegration().fetchSmooveContact('john.doe@example.com', {
      by: 'email',
    }),
  ).toMatchObject({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    telephone: '0546344457',
    birthday: new Date('2000-01-01'),
  })

  const studentNumber = new URL(await page.url()).pathname.split('/').at(-1)

  await expect(updateStudentModel.pageTitle().locator).toHaveText(`Update Student ${studentNumber}`)

  const updateForm = updateStudentModel.form()
  await expect(updateForm.names().firstNameInput(0).locator).toHaveValue('John')
  await expect(updateForm.names().lastNameInput(0).locator).toHaveValue('Doe')
  await expect(updateForm.emails().emailInput(0).locator).toHaveValue('john.doe@example.com')
  await expect(updateForm.phones().phoneInput(0).locator).toHaveValue('0546344457')
  await expect(updateForm.birthdayInput().locator).toHaveValue('2000-01-01')

  // Update the student data
  await updateForm.names().firstNameInput(0).locator.fill('Jane')
  await updateForm.names().lastNameInput(0).locator.fill('Smith')
  await updateForm.emails().emailInput(0).locator.fill('Jane.Smith@example.com')
  await updateForm.phones().phoneInput(0).locator.fill('546344456')
  await updateForm.birthdayInput().locator.fill('2001-02-02')

  // Save the student and verify data

  await updateForm.updateButton().locator.click()
  await expect(updateForm.names().firstNameInput(0).locator).toHaveValue('Jane')
  await expect(updateForm.names().lastNameInput(0).locator).toHaveValue('Smith')
  await expect(updateForm.emails().emailInput(0).locator).toHaveValue('jane.smith@example.com')
  await expect(updateForm.phones().phoneInput(0).locator).toHaveValue('0546344456')
  await expect(updateForm.birthdayInput().locator).toHaveValue('2001-02-02')

  expect(
    await smooveIntegration().fetchSmooveContact('jane.smith@example.com', {
      by: 'email',
    }),
  ).toMatchObject({
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    telephone: '0546344456',
    birthday: new Date('2001-02-02'),
  })

  // Back to list
  await page.goto(url().href)

  // Check that the student appears in the list
  const rows = studentListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = studentListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Jane Smith')
  await expect(firstRow.emailCell().locator).toHaveText('jane.smith@example.com')
  await expect(firstRow.phoneCell().locator).toHaveText('0546344456')
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
  await newForm.emails().emailInput(0).locator.fill('john.doe@example.com')

  await newForm.phones().trashButton(0).locator.click()
  await newForm.facebookNames().trashButton(0).locator.click()

  await newForm.createButton().locator.click()
  await page.waitForURL(updateStudentModel.urlRegex)

  const updateForm = updateStudentModel.form()
  await expect(updateForm.names().firstNameInput(0).locator).toHaveValue('John')
  await expect(updateForm.names().lastNameInput(0).locator).toHaveValue('Doe')
  await expect(newForm.emails().emailInput(0).locator).toHaveValue('john.doe@example.com')

  await updateForm.names().firstNameInput(0).locator.fill('Jane')
  await updateForm.names().lastNameInput(0).locator.fill('Smith')
  await newForm.emails().addButton().locator.click()
  await expect(newForm.emails().emailInput(0).locator).toBeVisible()

  await updateForm.discardButton().locator.click()

  await expect(newForm.names().firstNameInput(0).locator).toHaveValue('John')
  await expect(newForm.names().lastNameInput(0).locator).toHaveValue('Doe')
  await expect(newForm.emails().emailInput(0).locator).toHaveValue('john.doe@example.com')
})

test('birthday field is optional', async ({page}) => {
  await page.goto(url().href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  await studentListModel.createNewStudentButton().locator.click()

  await page.waitForURL(newStudentModel.urlRegex)

  await expect(newStudentModel.form().birthdayInput().locator).toHaveValue('')

  await newStudentModel.form().names().firstNameInput(0).locator.fill('John')
  await newStudentModel.form().names().lastNameInput(0).locator.fill('Doe')
  await newStudentModel.form().emails().emailInput(0).locator.fill('john.doe@example.com')
  await newStudentModel.form().phones().trashButton(0).locator.click()
  await newStudentModel.form().facebookNames().trashButton(0).locator.click()

  await newStudentModel.form().createButton().locator.click()

  await page.waitForURL(updateStudentModel.urlRegex)

  await expect(updateStudentModel.form().birthdayInput().locator).toHaveValue('')

  await updateStudentModel.form().names().firstNameInput(0).locator.fill('Jane')
  await updateStudentModel.form().names().lastNameInput(0).locator.fill('Smith')

  await updateStudentModel.form().updateButton().locator.click()

  await expect(updateStudentModel.form().birthdayInput().locator).toHaveValue('')

  await updateStudentModel.form().birthdayInput().locator.fill('2025-03-04')

  await updateStudentModel.form().updateButton().locator.click()

  await expect(updateStudentModel.history().items().locator).toHaveCount(2)
})

test('creation/update error shows alert', async ({page}) => {
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
  await newForm.emails().emailInput(0).locator.fill('John.Doe@example.com')
  await newForm.phones().phoneInput(0).locator.fill('+972-54-6344457')
  await newForm.birthdayInput().locator.fill('2000-01-01')
  await newForm.facebookNames().facebookNameInput(0).locator.fill('johnfb')

  TEST_hooks['createStudent'] = () => {
    throw new Error('ouch!')
  }

  await newForm.createButton().locator.click()

  await expect(newStudentModel.header().errorBanner().locator).toHaveText(
    'Creating student error: ouch!',
  )
  delete TEST_hooks['createStudent']

  await newForm.createButton().locator.click()

  await page.waitForURL(updateStudentModel.urlRegex)

  await updateStudentModel.form().names().firstNameInput(0).locator.fill('Jane')

  TEST_hooks['updateStudent'] = () => {
    throw new Error('double ouch!')
  }

  await updateStudentModel.form().updateButton().locator.click()

  await expect(updateStudentModel.header().errorBanner().locator).toHaveText(
    'Updating student error: double ouch!',
  )
})
