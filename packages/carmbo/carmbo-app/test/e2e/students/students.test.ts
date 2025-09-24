import {test, expect} from '@playwright/test'
import {runDockerCompose, tcpHealthCheck} from '@giltayar/docker-compose-testkit'
import type {Sql} from 'postgres'
import postgres from 'postgres'
import {makeApp} from '../../../src/app/carmbo-app.ts'
import type {FastifyInstance} from 'fastify'
import type {AddressInfo} from 'node:net'
import {createStudentListPageModel} from '../page-model/student-list-page.model.ts'
import {createNewStudentPageModel} from '../page-model/new-student-page.model.ts'
import {createUpdateStudentPageModel} from '../page-model/update-student-page.model.ts'
import {createViewStudentHistoryPageModel} from '../page-model/view-student-history-page.model copy.ts'

let findAddress
let teardown: (() => Promise<void>) | undefined
let sql: Sql
let app: FastifyInstance
let url: URL

test.beforeAll(async () => {
  ;({findAddress, teardown} = await runDockerCompose(
    new URL('../docker-compose.yaml', import.meta.url),
    {},
  ))

  sql = postgres({
    host: await findAddress('carmbo-postgres', 5432, {healthCheck: tcpHealthCheck}),
    database: 'carmbo',
    username: 'user',
    password: 'password',
  })

  app = makeApp({
    db: {
      host: sql.options.host[0],
      port: sql.options.port[0],
      username: sql.options.user,
      password: 'password',
    },
  })

  await app.listen()
  app.server.unref()

  const {port, address} = app.server.address() as AddressInfo

  url = new URL(`http://${address}:${port}`)
})

test.beforeEach(async () => {
  await sql`TRUNCATE TABLE student CASCADE`
})

test.afterAll(async () => teardown?.())

test('create student then update her', async ({page}) => {
  await page.goto(url.href)

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
  await newForm.saveButton().locator.click()

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

  await newForm.saveButton().locator.click()
  await expect(updateForm.names().firstNameInput(0).locator).toHaveValue('Jane')
  await expect(updateForm.names().lastNameInput(0).locator).toHaveValue('Smith')
  await expect(updateForm.emails().emailInput(0).locator).toHaveValue('jane.smith@example.com')
  await expect(updateForm.phones().phoneInput(0).locator).toHaveValue('0987654321')
  await expect(updateForm.birthdayInput().locator).toHaveValue('2001-02-02')

  // Back to list
  await page.goto(url.href)

  // Check that the student appears in the list
  const rows = studentListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = studentListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Jane Smith')
  await expect(firstRow.emailCell().locator).toHaveText('jane.smith@example.com')
  await expect(firstRow.phoneCell().locator).toHaveText('0987654321')
})

test('create student and update multiple fields', async ({page}) => {
  await page.goto(url.href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  await studentListModel.createNewStudentButton().locator.click()

  await page.waitForURL(newStudentModel.urlRegex)

  // Fill the names
  const newForm = newStudentModel.form()
  await newForm.names().firstNameInput(0).locator.fill('John')
  await newForm.names().lastNameInput(0).locator.fill('Doe')
  await newForm.names().addButton().locator.click()
  await newForm.names().firstNameInput(1).locator.fill('first2')
  await newForm.names().lastNameInput(1).locator.fill('last2')
  await newForm.names().addButton().locator.click()
  await newForm.names().firstNameInput(2).locator.fill('first3')
  await newForm.names().lastNameInput(2).locator.fill('last3')

  await newForm.names().trashButton(1).locator.click()

  await expect(newForm.names().firstNameInput(0).locator).toHaveValue('John')
  await expect(newForm.names().lastNameInput(0).locator).toHaveValue('Doe')
  await expect(newForm.names().firstNameInput(1).locator).toHaveValue('first3')
  await expect(newForm.names().lastNameInput(1).locator).toHaveValue('last3')

  // Fill the emails
  await newForm.emails().emailInput(0).locator.fill('john.doe@example.com')
  await newForm.emails().addButton().locator.click()
  await newForm.emails().emailInput(1).locator.fill('email2@example.com')
  await newForm.emails().addButton().locator.click()

  // Wait for the third email field to appear
  await expect(newForm.emails().emailInput(2).locator).toBeVisible()

  await newForm.emails().emailInput(2).locator.fill('email3@example.com')
  await newForm.emails().trashButton(1).locator.click()

  await expect(newForm.emails().emailInput(0).locator).toHaveValue('john.doe@example.com')
  await expect(newForm.emails().emailInput(1).locator).toHaveValue('email3@example.com')

  // Fill the phones
  await newForm.phones().phoneInput(0).locator.fill('1234567890')
  await newForm.phones().addButton().locator.click()
  await newForm.phones().phoneInput(1).locator.fill('2222222222')
  await newForm.phones().addButton().locator.click()

  // Wait for the third phone field to appear
  await expect(newForm.phones().phoneInput(2).locator).toBeVisible()

  await newForm.phones().phoneInput(2).locator.fill('3333333333')
  await newForm.phones().trashButton(1).locator.click()

  await expect(newForm.phones().phoneInput(0).locator).toHaveValue('1234567890')
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

  await newForm.saveButton().locator.click()

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

  await updateForm.saveButton().locator.click()

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

  await page.goto(url.href)

  const rows = studentListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = studentListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('first3 last3, first4 last4')
  await expect(firstRow.emailCell().locator).toHaveText('email3@example.com, email4@example.com')
  await expect(firstRow.phoneCell().locator).toHaveText('3333333333, 4444444444')
})

test('form validations', async ({page}) => {
  await page.goto(url.href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  await studentListModel.createNewStudentButton().locator.click()

  await page.waitForURL(newStudentModel.urlRegex)

  const newForm = newStudentModel.form()
  // Fill no names
  await newForm.saveButton().locator.click()

  await expect(page.url()).toMatch(newStudentModel.urlRegex)

  await newForm.names().firstNameInput(0).locator.fill('John')
  await newForm.names().lastNameInput(0).locator.fill('Doe')

  // bad email
  await newForm.emails().emailInput(0).locator.fill('invalid-email')

  await newForm.saveButton().locator.click()

  await expect(page.url()).toMatch(newStudentModel.urlRegex)
  await newForm.emails().emailInput(0).locator.fill('valid@email.copm')

  // bad phone
  await newForm.phones().phoneInput(0).locator.fill('invalid-phone')

  await newForm.saveButton().locator.click()

  await expect(page.url()).toMatch(newStudentModel.urlRegex)
  await newForm.phones().phoneInput(0).locator.fill('+972-48678.423984')

  // bad facebook name
  await newForm.saveButton().locator.click()

  await expect(page.url()).toMatch(newStudentModel.urlRegex)

  await newForm.facebookNames().facebookNameInput(0).locator.fill('valid.fbname')

  await newForm.saveButton().locator.click()

  await page.waitForURL(updateStudentModel.urlRegex)
})

test('remove names and other fieldsd', async ({page}) => {
  await page.goto(url.href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  await studentListModel.createNewStudentButton().locator.click()

  await page.waitForURL(newStudentModel.urlRegex)

  // Remove all possible names
  const newForm = newStudentModel.form()
  await newForm.names().trashButton(0).locator.click()

  await newForm.emails().trashButton(0).locator.click()

  await newForm.phones().trashButton(0).locator.click()
  await newForm.facebookNames().trashButton(0).locator.click()

  await newForm.saveButton().locator.click()

  await page.waitForURL(updateStudentModel.urlRegex)

  const updateForm = updateStudentModel.form()

  await expect(updateForm.saveButton().locator).toBeVisible()

  await expect(updateForm.names().firstNameInput(0).locator).not.toBeVisible()
  await expect(updateForm.names().lastNameInput(0).locator).not.toBeVisible()

  await expect(updateForm.emails().emailInput(0).locator).not.toBeVisible()

  await expect(updateForm.phones().phoneInput(0).locator).not.toBeVisible()
  await expect(updateForm.facebookNames().facebookNameInput(0).locator).not.toBeVisible()

  // Add new fields
  await updateForm.names().addButton().locator.click()
  await updateForm.names().firstNameInput(0).locator.fill('first3')
  await updateForm.names().lastNameInput(0).locator.fill('last3')

  await updateForm.emails().addButton().locator.click()
  await updateForm.emails().emailInput(0).locator.fill('email3@example.com')

  await updateForm.phones().addButton().locator.click()
  await updateForm.phones().phoneInput(0).locator.fill('3333333333')

  await updateForm.facebookNames().addButton().locator.click()
  await updateForm.facebookNames().facebookNameInput(0).locator.fill('fb3')

  await updateForm.saveButton().locator.click()

  await expect(page.url()).toMatch(updateStudentModel.urlRegex)

  await expect(updateForm.names().firstNameInput(0).locator).toHaveValue('first3')
  await expect(updateForm.names().lastNameInput(0).locator).toHaveValue('last3')

  await expect(updateForm.emails().emailInput(0).locator).toHaveValue('email3@example.com')
  await expect(updateForm.phones().phoneInput(0).locator).toHaveValue('3333333333')
  await expect(updateForm.facebookNames().facebookNameInput(0).locator).toHaveValue('fb3')
})

test('can view history', async ({page}) => {
  await page.goto(url.href)

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

  await newForm.saveButton().locator.click()

  await page.waitForURL(updateStudentModel.urlRegex)

  const updateHistory = updateStudentModel.history()
  const updateForm = updateStudentModel.form()

  await expect(updateHistory.items().locator).toHaveCount(1)
  await expect(updateHistory.items().item(0).locator).toContainText('create')

  await updateForm.names().firstNameInput(0).locator.fill('2')

  await updateForm.saveButton().locator.click()

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

  await expect(historyPage.items().locator).toHaveCount(2)
  await expect(historyPage.items().item(0).locator).toContainText('update')
  await expect(historyPage.items().item(1).locator).toContainText('create')
  await expect(historyPage.items().item(0).link().locator).not.toBeVisible()

  await expect(historyForm.names().firstNameInput(0).locator).toHaveValue('2')
})

test('multiple students have different histories', async ({page}) => {
  await page.goto(url.href)

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

  await newForm1.saveButton().locator.click()
  await page.waitForURL(updateStudentModel.urlRegex)

  // Get the first student's URL
  const firstStudentUrl = await page.url()

  // Update first student
  const updateForm1 = updateStudentModel.form()
  await updateForm1.names().firstNameInput(0).locator.fill('Alice-Updated')

  await updateForm1.saveButton().locator.click()

  await expect(updateStudentModel.history().items().locator).toHaveCount(2)

  // Go back to student list to create second student
  await page.goto(url.href)
  await studentListModel.createNewStudentButton().locator.click()
  await page.waitForURL(newStudentModel.urlRegex)

  // Create second student
  const newForm2 = newStudentModel.form()
  await newForm2.names().firstNameInput(0).locator.fill('Bob')
  await newForm2.names().lastNameInput(0).locator.fill('Williams')

  await newForm2.emails().trashButton(0).locator.click()
  await newForm2.phones().trashButton(0).locator.click()
  await newForm2.facebookNames().trashButton(0).locator.click()

  await newForm2.saveButton().locator.click()

  await expect(updateStudentModel.history().items().locator).toHaveCount(1)

  // Get the second student's number from URL
  const secondStudentUrl = await page.url()

  // Update second student
  const updateForm2 = updateStudentModel.form()
  await updateForm2.names().firstNameInput(0).locator.fill('Bob-Updated')

  await updateForm2.saveButton().locator.click()

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

test('deleting a student', async ({page}) => {
  await page.goto(url.href)

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

  await newForm1.saveButton().locator.click()
  await page.waitForURL(updateStudentModel.urlRegex)

  // Go back to student list to create second student
  await page.goto(url.href)
  await studentListModel.createNewStudentButton().locator.click()
  await page.waitForURL(newStudentModel.urlRegex)

  // Create second student
  const newForm2 = newStudentModel.form()
  await newForm2.names().firstNameInput(0).locator.fill('Bob')
  await newForm2.names().lastNameInput(0).locator.fill('Williams')

  await newForm2.emails().trashButton(0).locator.click()
  await newForm2.phones().trashButton(0).locator.click()
  await newForm2.facebookNames().trashButton(0).locator.click()

  await newForm2.saveButton().locator.click()
  await page.waitForURL(updateStudentModel.urlRegex)

  // Delete the second student (Bob)
  await updateStudentModel.form().deleteButton().locator.click()

  await expect(updateStudentModel.pageTitle().locator).toContainText('(deleted)')
  await expect(updateStudentModel.history().items().locator).toHaveCount(2)
  await expect(updateStudentModel.history().items().item(0).locator).toContainText('delete')
  await expect(updateStudentModel.history().items().item(1).locator).toContainText('create')

  await page.goto(url.href)

  // Verify only Alice is visible (Bob should be archived/hidden)
  const rows = studentListModel.list().rows()
  await expect(rows.locator).toHaveCount(1)
  const firstRow = studentListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('Alice Johnson')

  // Check the "Show archived" checkbox to show deleted students
  await studentListModel.search().showArchivedCheckbox().locator.click()
  await studentListModel.search().refreshButton().locator.click()

  // Now both students should be visible
  await expect(rows.locator).toHaveCount(2)

  await expect(studentListModel.search().showArchivedCheckbox().locator).toBeChecked()

  // Verify both students are present, with one marked as deleted
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
