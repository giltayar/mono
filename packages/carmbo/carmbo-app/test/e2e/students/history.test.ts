import {test, expect} from '@playwright/test'
import {createStudentListPageModel} from '../page-model/student-list-page.model.ts'
import {createNewStudentPageModel} from '../page-model/new-student-page.model.ts'
import {createUpdateStudentPageModel} from '../page-model/update-student-page.model.ts'
import {createViewStudentHistoryPageModel} from '../page-model/view-student-history-page.model copy.ts'
import {setup} from './setup.ts'

const {url} = setup(import.meta.url)

test('can view history', async ({page}) => {
  await page.goto(url().href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)
  const viewStudentHistoryModel = createViewStudentHistoryPageModel(page)

  await studentListModel.createNewStudentButton().locator.click()

  await page.waitForURL(newStudentModel.urlRegex)

  const newForm = newStudentModel.form()
  await newForm.names().firstNameInput(0).locator.fill('1')
  await newForm.names().lastNameInput(0).locator.fill('Doe')

  await newForm.emails().trashButton(0).locator.click()
  await newForm.phones().trashButton(0).locator.click()
  await newForm.facebookNames().trashButton(0).locator.click()

  await newForm.createButton().locator.click()

  await page.waitForURL(updateStudentModel.urlRegex)

  const updateHistory = updateStudentModel.history()
  const updateForm = updateStudentModel.form()

  await expect(updateHistory.items().locator).toHaveCount(1)
  await expect(updateHistory.items().item(0).locator).toContainText('create')

  await updateForm.names().firstNameInput(0).locator.fill('2')

  await updateForm.updateButton().locator.click()

  await expect(updateHistory.items().locator).toHaveCount(2)
  await expect(updateHistory.items().item(0).locator).toContainText('update')
  await expect(updateHistory.items().item(1).locator).toContainText('create')
  await expect(updateHistory.items().item(0).link().locator).not.toBeVisible()

  await updateHistory.items().item(1).link().locator.click()

  await expect(page.url()).toMatch(viewStudentHistoryModel.urlRegex)

  const historyPage = viewStudentHistoryModel.history()
  const historyForm = viewStudentHistoryModel.form()

  await expect(historyPage.items().locator).toHaveCount(2)
  await expect(historyPage.items().item(0).locator).toContainText('update')
  await expect(historyPage.items().item(1).locator).toContainText('create')
  await expect(historyPage.items().item(1).link().locator).not.toBeVisible()

  await expect(historyForm.names().firstNameInput(0).locator).toHaveValue('1')

  await historyPage.items().item(0).link().locator.click()

  await page.waitForURL(updateStudentModel.urlRegex)

  await expect(updateHistory.items().locator).toHaveCount(2)
  await expect(updateStudentModel.pageTitle().locator).toHaveText(/Update Student \d+/)
  await expect(updateHistory.items().item(0).locator).toContainText('update')
  await expect(updateHistory.items().item(1).locator).toContainText('create')
  await expect(updateHistory.items().item(0).link().locator).not.toBeVisible()

  await expect(historyForm.names().firstNameInput(0).locator).toHaveValue('2')
})

test('multiple students have different histories', async ({page}) => {
  await page.goto(url().href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)
  const viewStudentHistoryModel = createViewStudentHistoryPageModel(page)

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

  // Get the first student's URL
  const firstStudentUrl = await page.url()

  // Update first student
  const updateForm1 = updateStudentModel.form()
  await updateForm1.names().firstNameInput(0).locator.fill('Alice-Updated')

  await updateForm1.updateButton().locator.click()

  await expect(updateStudentModel.history().items().locator).toHaveCount(2)

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

  await expect(updateStudentModel.history().items().locator).toHaveCount(1)

  // Get the second student's number from URL
  const secondStudentUrl = await page.url()

  // Update second student
  const updateForm2 = updateStudentModel.form()
  await updateForm2.names().firstNameInput(0).locator.fill('Bob-Updated')

  await updateForm2.updateButton().locator.click()

  await expect(updateStudentModel.history().items().locator).toHaveCount(2)

  // Verify first student's history
  await page.goto(firstStudentUrl)
  await page.waitForURL(updateStudentModel.urlRegex)

  const firstUpdateHistory = updateStudentModel.history()
  await expect(firstUpdateHistory.items().locator).toHaveCount(2)
  await expect(firstUpdateHistory.items().item(0).locator).toContainText('update')
  await expect(firstUpdateHistory.items().item(1).locator).toContainText('create')

  // Go to first student's history page
  await firstUpdateHistory.items().item(1).link().locator.click()
  await expect(page.url()).toMatch(viewStudentHistoryModel.urlRegex)

  const firstHistoryForm = viewStudentHistoryModel.form()
  await expect(firstHistoryForm.names().firstNameInput(0).locator).toHaveValue('Alice')
  await expect(firstHistoryForm.names().lastNameInput(0).locator).toHaveValue('Johnson')

  // Check the updated version of first student
  const firstHistoryPage = viewStudentHistoryModel.history()
  await firstHistoryPage.items().item(0).link().locator.click()
  await expect(firstHistoryForm.names().firstNameInput(0).locator).toHaveValue('Alice-Updated')
  await expect(firstHistoryForm.names().lastNameInput(0).locator).toHaveValue('Johnson')

  // Verify second student's history
  await page.goto(secondStudentUrl)
  await page.waitForURL(updateStudentModel.urlRegex)

  const secondUpdateHistory = updateStudentModel.history()
  await expect(secondUpdateHistory.items().locator).toHaveCount(2)
  await expect(secondUpdateHistory.items().item(0).locator).toContainText('update')
  await expect(secondUpdateHistory.items().item(1).locator).toContainText('create')

  // Go to second student's history page
  await secondUpdateHistory.items().item(1).link().locator.click()
  await expect(page.url()).toMatch(viewStudentHistoryModel.urlRegex)

  const secondHistoryForm = viewStudentHistoryModel.form()
  await expect(secondHistoryForm.names().firstNameInput(0).locator).toHaveValue('Bob')
  await expect(secondHistoryForm.names().lastNameInput(0).locator).toHaveValue('Williams')

  // Check the updated version of second student
  const secondHistoryPage = viewStudentHistoryModel.history()
  await secondHistoryPage.items().item(0).link().locator.click()
  await expect(secondHistoryForm.names().firstNameInput(0).locator).toHaveValue('Bob-Updated')
  await expect(secondHistoryForm.names().lastNameInput(0).locator).toHaveValue('Williams')
})
