import {test, expect} from '@playwright/test'
import {createStudentListPageModel} from '../page-model/student-list-page.model.ts'
import {setup} from './setup.ts'
import {TEST_seedStudents} from '../../../src/students/model.ts'
import {createUpdateStudentPageModel} from '../page-model/update-student-page.model.ts'

const {url, sql} = setup(import.meta.url)

test('searching students', async ({page}) => {
  test.slow()

  await TEST_seedStudents(sql(), 200)

  await page.reload()

  await page.goto(url().href)

  const studentListModel = createStudentListPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  if ((await studentListModel.list().rows().locator.count()) === 0) {
    await TEST_seedStudents(sql(), 200)

    await page.reload()
  }

  await expect(studentListModel.list().rows().locator).toHaveCount(50)

  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('1')
  await expect(studentListModel.list().rows().row(0).nameCell().locator).toHaveText(
    'Jessie Fujiwara, Virgie Porciani, Bernice Pettini',
  )

  await expect(studentListModel.list().rows().row(49).idLink().locator).toHaveText('50')
  await expect(studentListModel.list().rows().row(49).emailCell().locator).toHaveText(
    'jatu@miunafit.kg, zimubpo@akweg.sg',
  )

  await studentListModel.list().rows().locator.nth(49).scrollIntoViewIfNeeded()

  await expect(studentListModel.list().rows().locator).toHaveCount(100)

  await expect(studentListModel.list().rows().row(0).nameCell().locator).toHaveText(
    'Jessie Fujiwara, Virgie Porciani, Bernice Pettini',
  )
  await expect(studentListModel.list().rows().row(49).emailCell().locator).toHaveText(
    'jatu@miunafit.kg, zimubpo@akweg.sg',
  )
  await expect(studentListModel.list().rows().row(53).nameCell().locator).toHaveText(
    'Jason Cardini, Joe Blank, Ora van de Pol',
  )
  await expect(studentListModel.list().rows().row(84).phoneCell().locator).toHaveText(
    '(758) 920-2862, (366) 349-8523, (335) 765-2536',
  )

  await studentListModel.list().rows().locator.nth(99).scrollIntoViewIfNeeded()

  await expect(studentListModel.list().rows().locator).toHaveCount(150)

  await studentListModel.list().rows().locator.nth(149).scrollIntoViewIfNeeded()

  await expect(studentListModel.list().rows().locator).toHaveCount(200)

  await studentListModel.list().rows().locator.nth(199).scrollIntoViewIfNeeded()

  await expect(studentListModel.list().rows().locator).toHaveCount(200)

  await studentListModel.search().queryInput().locator.fill('Jessie')

  await expect(studentListModel.list().rows().locator).toHaveCount(3)
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('1')
  await expect(studentListModel.list().rows().row(0).nameCell().locator).toContainText('Jessie')
  await expect(studentListModel.list().rows().row(2).nameCell().locator).toContainText('Jessie')
  // Row 1 does not contain Jessie because the facebook name contains jessie but is not visible here

  await studentListModel.search().queryInput().locator.fill('akweg.sg')

  await expect(studentListModel.list().rows().locator).toHaveCount(1)
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('50')
  await expect(studentListModel.list().rows().row(0).emailCell().locator).toContainText('akweg.sg')

  await studentListModel.search().queryInput().locator.fill('60')
  await expect(studentListModel.list().rows().locator).toHaveCount(50)

  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('5')
  await expect(studentListModel.list().rows().row(0).nameCell().locator).toContainText(
    'Victoria Vaughan, Loretta Ermini, Matilda Becucci',
  )
  await expect(studentListModel.list().rows().row(1).idLink().locator).toHaveText('8')
  await expect(studentListModel.list().rows().row(1).phoneCell().locator).toContainText(
    '(421) 604-3714, (524) 556-4978, (772) 538-2630',
  )
  await studentListModel.list().rows().locator.nth(49).scrollIntoViewIfNeeded()

  await expect(studentListModel.list().rows().locator).toHaveCount(56)

  await page.goto(url().href + 'students/1')

  await updateStudentModel.form().deleteButton().locator.click()
  await expect(updateStudentModel.form().restoreButton().locator).toBeVisible()

  await page.goto(url().href)

  await studentListModel.search().queryInput().locator.fill('Jessie')

  await expect(studentListModel.list().rows().locator).toHaveCount(2)
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('97')

  await studentListModel.search().showArchivedCheckbox().locator.check()
  await expect(studentListModel.list().rows().locator).toHaveCount(2)
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('1')
})
