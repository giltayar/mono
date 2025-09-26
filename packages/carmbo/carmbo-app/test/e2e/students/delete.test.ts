import {test, expect} from '@playwright/test'
import {createStudentListPageModel} from '../page-model/student-list-page.model.ts'
import {createNewStudentPageModel} from '../page-model/new-student-page.model.ts'
import {createUpdateStudentPageModel} from '../page-model/update-student-page.model.ts'
import {setup} from './setup.ts'

const {url} = setup(import.meta.url)

test('deleting a student', async ({page}) => {
  await page.goto(url().href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  // Create first student
  await studentListModel.createNewStudentButton().locator.click()
  await page.waitForURL(newStudentModel.urlRegex)

  const newForm1 = newStudentModel.form()
  await newForm1.names().firstNameInput(0).locator.fill('Alice')
  await newForm1.names().lastNameInput(0).locator.fill('Johnson')

  await newForm1.emails().trashButton(0).locator.click()
  await newForm1.phones().trashButton(0).locator.click()
  await newForm1.facebookNames().trashButton(0).locator.click()

  await newForm1.createButton().locator.click()
  await page.waitForURL(updateStudentModel.urlRegex)

  // Go back to student list to create second student
  await page.goto(url().href)
  await studentListModel.createNewStudentButton().locator.click()
  await page.waitForURL(newStudentModel.urlRegex)

  // Create second student
  const newForm2 = newStudentModel.form()
  await newForm2.names().firstNameInput(0).locator.fill('Bob')
  await newForm2.names().lastNameInput(0).locator.fill('Williams')

  await newForm2.emails().trashButton(0).locator.click()
  await newForm2.phones().trashButton(0).locator.click()
  await newForm2.facebookNames().trashButton(0).locator.click()

  await newForm2.createButton().locator.click()
  await page.waitForURL(updateStudentModel.urlRegex)

  // Delete the second student (Bob)
  await updateStudentModel.form().deleteButton().locator.click()

  await expect(updateStudentModel.pageTitle().locator).toContainText('(archived)')
  await expect(updateStudentModel.history().items().locator).toHaveCount(2)
  await expect(updateStudentModel.history().items().item(0).locator).toContainText('archived')
  await expect(updateStudentModel.history().items().item(1).locator).toContainText('created')

  await page.goto(url().href)

  // Verify only Alice is visible (Bob should be archived/hidden)
  const rows = studentListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = studentListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Alice Johnson')

  // Check the "Show archived" checkbox to show archived students
  await studentListModel.search().showArchivedCheckbox().locator.click()
  await studentListModel.search().refreshButton().locator.click()

  // Now both students should be visible
  await expect(rows.locator).toHaveCount(2)

  await expect(studentListModel.search().showArchivedCheckbox().locator).toBeChecked()

  // Verify both students are present, with one marked as archived
  expect(studentListModel.list().rows().row(0).nameCell().locator).toHaveText('Alice Johnson')
  expect(studentListModel.list().rows().row(1).nameCell().locator).toHaveText('Bob Williams')

  // Uncheck the "Show archived" checkbox
  await studentListModel.search().showArchivedCheckbox().locator.click()
  await studentListModel.search().refreshButton().locator.click()

  // Should be back to only showing Alice
  await expect(rows.locator).toHaveCount(1)
  await expect(firstRow.nameCell().locator).toHaveText('Alice Johnson')
  await expect(studentListModel.search().showArchivedCheckbox().locator).not.toBeChecked()
})

test('restoring a student', async ({page}) => {
  await page.goto(url().href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  // Create first student
  await studentListModel.createNewStudentButton().locator.click()
  await page.waitForURL(newStudentModel.urlRegex)

  const newForm1 = newStudentModel.form()
  await newForm1.names().firstNameInput(0).locator.fill('Alice')
  await newForm1.names().lastNameInput(0).locator.fill('Johnson')

  await newForm1.emails().trashButton(0).locator.click()
  await newForm1.phones().trashButton(0).locator.click()
  await newForm1.facebookNames().trashButton(0).locator.click()

  await newForm1.createButton().locator.click()
  await page.waitForURL(updateStudentModel.urlRegex)

  // Delete the student
  await updateStudentModel.form().deleteButton().locator.click()

  await expect(updateStudentModel.pageTitle().locator).toContainText('(archived)')

  await expect(updateStudentModel.form().deleteButton().locator).not.toBeVisible()

  await updateStudentModel.form().restoreButton().locator.click()

  await expect(updateStudentModel.history().items().locator).toHaveCount(3)
  await expect(updateStudentModel.history().items().item(0).locator).toContainText('restored')
  await expect(updateStudentModel.history().items().item(1).locator).toContainText('archived')
  await expect(updateStudentModel.history().items().item(2).locator).toContainText('created')

  await expect(updateStudentModel.pageTitle().locator).not.toContainText('(archived)')

  await page.goto(url().href)

  // Verify Bob is visible again
  const rows = studentListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = studentListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Alice Johnson')
})
