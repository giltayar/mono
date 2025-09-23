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
