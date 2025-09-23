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

test('create student', async ({page}) => {
  await page.goto(url.href)

  const studentListModel = createStudentListPageModel(page)
  const newStudentModel = createNewStudentPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  await studentListModel.createNewStudentButton().locator.click()

  await page.waitForURL(newStudentModel.urlRegex)
  // Fill the new student form
  const form = newStudentModel.form()
  await form.names().firstNameInput(0).locator.fill('John')
  await form.names().lastNameInput(0).locator.fill('Doe')
  await form.emails().emailInput(0).locator.fill('john.doe@example.com')
  await form.phones().phoneInput(0).locator.fill('1234567890')
  await form.birthdayInput().locator.fill('2000-01-01')

  // Save the student
  await form.saveButton().locator.click()

  // Wait for navigation to update page
  await page.waitForURL(updateStudentModel.urlRegex)

  // Back to list
  await page.goto(url.href)

  // Check that the student appears in the list
  const rows = studentListModel.list().rows().locator
  await expect(rows).toHaveCount(1)
  const firstRow = studentListModel.list().rows().row(0)
  await expect(firstRow.nameCell().locator).toHaveText('John Doe')
  await expect(firstRow.emailCell().locator).toHaveText('john.doe@example.com')
  await expect(firstRow.phoneCell().locator).toHaveText('1234567890')
})
