import {test, expect} from '@playwright/test'
import {createStudentListPageModel} from '../page-model/students/student-list-page.model.ts'
import {setup} from '../common/setup.ts'
import {TEST_seedStudents} from '../../../src/domain/student/model.ts'
import {createUpdateStudentPageModel} from '../page-model/students/update-student-page.model.ts'

const {url, sql} = setup(import.meta.url)

test('searching students', async ({page}) => {
  test.slow()

  await TEST_seedStudents(sql(), 200)

  await page.goto(url().href)

  const studentListModel = createStudentListPageModel(page)
  const updateStudentModel = createUpdateStudentPageModel(page)

  await expect(studentListModel.list().rows().locator).toHaveCount(50)

  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('1')
  await expect(studentListModel.list().rows().row(0).nameCell().locator).toHaveText(
    'Jessie Fujiwara, Virgie Porciani, Bernice Pettini',
  )

  await expect(studentListModel.list().rows().row(49).idLink().locator).toHaveText('50')
  await studentListModel.list().rows().locator.nth(49).scrollIntoViewIfNeeded()
  await expect(studentListModel.list().rows().row(49).emailCell().locator).toHaveText(
    'piliw@hucef.mg, famese@jabi.ee',
  )

  await expect(studentListModel.list().rows().locator).toHaveCount(100)

  await expect(studentListModel.list().rows().row(0).nameCell().locator).toHaveText(
    'Jessie Fujiwara, Virgie Porciani, Bernice Pettini',
  )
  await expect(studentListModel.list().rows().row(49).emailCell().locator).toHaveText(
    'piliw@hucef.mg, famese@jabi.ee',
  )
  await studentListModel.list().rows().locator.nth(53).scrollIntoViewIfNeeded()
  await expect(studentListModel.list().rows().row(53).nameCell().locator).toHaveText(
    'Roy Hopman, Harry Coleman, Jane Smith',
  )
  await studentListModel.list().rows().locator.nth(84).scrollIntoViewIfNeeded()
  await expect(studentListModel.list().rows().row(84).phoneCell().locator).toHaveText(
    '(834) 509-9781, (416) 827-6514, (917) 830-3087',
  )

  await studentListModel.list().rows().locator.nth(99).scrollIntoViewIfNeeded()

  await expect(studentListModel.list().rows().locator).toHaveCount(150)

  await studentListModel.list().rows().locator.nth(149).scrollIntoViewIfNeeded()

  await expect(studentListModel.list().rows().locator).toHaveCount(200)

  await studentListModel.list().rows().locator.nth(199).scrollIntoViewIfNeeded()

  await expect(studentListModel.list().rows().locator).toHaveCount(200)

  await studentListModel.search().queryInput().locator.fill('Jessie')

  await expect(studentListModel.list().rows().locator).toHaveCount(2)
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('1')
  await expect(studentListModel.list().rows().row(0).nameCell().locator).toContainText('Jessie')
  // Row 1 does not contain Jessie because the facebook name contains jessie but is not visible here

  await studentListModel.search().queryInput().locator.fill('jabi.ee')

  await expect(studentListModel.list().rows().locator).toHaveCount(1)
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('50')
  await expect(studentListModel.list().rows().row(0).emailCell().locator).toContainText('jabi.ee')

  await page.goto(url().href)

  await studentListModel.search().queryInput().locator.fill('st')

  await expect(studentListModel.list().rows().locator).toHaveCount(50)

  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('8')
  await expect(studentListModel.list().rows().row(0).nameCell().locator).toContainText(
    'Robert Vangelisti, Lydia Moody, Maude Cambi',
  )
  await expect(studentListModel.list().rows().row(1).idLink().locator).toHaveText('14')
  await expect(studentListModel.list().rows().row(1).nameCell().locator).toContainText(
    'Winnie Maruyama, Addie Harmon, Cole Xu',
  )
  await studentListModel.list().rows().locator.nth(49).scrollIntoViewIfNeeded()

  await expect(studentListModel.list().rows().locator).toHaveCount(52)

  await page.goto(url().href + 'students/1')

  await updateStudentModel.form().deleteButton().locator.click()
  await expect(updateStudentModel.form().restoreButton().locator).toBeVisible()

  await page.goto(url().href)

  await studentListModel.search().queryInput().locator.fill('Jessie')

  await expect(studentListModel.list().rows().locator).toHaveCount(1)
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('88')

  await studentListModel.search().showArchivedCheckbox().locator.check()
  await expect(studentListModel.list().rows().locator).toHaveCount(2)
  await expect(studentListModel.list().rows().row(0).idLink().locator).toHaveText('1')
})
