import {expect, test} from '@playwright/test'
import {registerJobHandler} from '@giltayar/carmbo-pages-job/jobs/handler'
import {createNewStudentPageModel} from '@giltayar/carmbo-pages-student/testkit/page-model/new-student-page.model'
import {createStudentListPageModel} from '@giltayar/carmbo-pages-student/testkit/page-model/student-list-page.model'
import {createJobListPageModel} from '../../page-model/jobs/job-list-page.model.ts'
import {setup} from '../common/setup.ts'

const {url} = setup(import.meta.url)

test('student route lists a created student', async ({page}) => {
  await page.goto(new URL('/students', url()).href)

  const studentList = createStudentListPageModel(page)
  await studentList.createNewStudentButton().locator.click()

  const newStudent = createNewStudentPageModel(page)
  await page.waitForURL(newStudent.urlRegex)

  const form = newStudent.form()
  await form.names().firstNameInput(0).locator.fill('Ada')
  await form.names().lastNameInput(0).locator.fill('Lovelace')
  await form.emails().emailInput(0).locator.fill('ada@example.com')
  await form.phones().phoneInput(0).locator.fill('0501234567')
  await form.facebookNames().facebookNameInput(0).locator.fill('ada-lovelace')
  await form.createButton().locator.click()
  await page.waitForURL(/\/students\/\d+$/)

  await page.goto(new URL('/students', url()).href)

  const rows = studentList.list().rows()
  await expect(rows.locator).toHaveCount(1)
  await expect(rows.row(0).nameCell().locator).toHaveText('Ada Lovelace')
  await expect(rows.row(0).emailCell().locator).toHaveText('ada@example.com')
})

test('jobs route lists a submitted job', async ({page}) => {
  const submitJob = registerJobHandler(
    'carmbo-app-listing-smoke',
    () => new Date(),
    {isTrivial: false},
    ({name}: {name: string}) => `Smoke job: ${name}`,
    async () => {},
  )
  await submitJob(
    {name: 'Visible job'},
    {scheduledAt: new Date('3000-01-01T00:00:00.000Z'), retries: 1},
  )

  await page.goto(new URL('/jobs', url()).href)

  const rows = createJobListPageModel(page).list().rows()
  await expect(rows.locator).toHaveCount(1)
  await expect(rows.row(0).descriptionCell().locator).toHaveText('Smoke job: Visible job')
})
