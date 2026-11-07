import {expect, test} from '@playwright/test'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'
import {
  createEmailListPageModel,
  createEmailPageModel,
} from '@giltayar/carmbo-pages-community/testkit/page-model/email.model'
import {setup} from '../common/setup.ts'
import {seedEmail} from './fixture.ts'
import {createMemberFixture} from '../common/member-fixture.ts'
import {addMember} from '../../../src/member-model.ts'
import {listEmails} from '../../../src/email/model.ts'

const {sql, url, registrationEmails, emailService} = setup(import.meta.url, {language: 'he'})

test('renders Hebrew email pages with RTL layout and localized statuses', async ({page}) => {
  const number = await seedEmail(sql(), {
    language: 'he',
    subject: 'הרשמה לקהילה',
    html: '<div dir="rtl">שלום לתלמידה ולקהילה</div>',
    text: 'שלום לתלמידה ולקהילה',
    status: 'success',
  })

  await page.goto(new URL('/emails', url()).href)
  const list = createEmailListPageModel(page)
  await expect(page).toHaveTitle('אימיילים')
  await expect(createAllPagesPageModel(page).documentElement().locator).toHaveAttribute(
    'dir',
    'rtl',
  )
  await expect(list.table().locator).toContainText('המסירה אושרה')
  await list.rows().row(0).number().locator.click()
  const detail = createEmailPageModel(page)
  await expect(detail.heading().locator).toHaveText(`אימייל ${number}`)
  await expect(detail.details().field('נושא').locator).toHaveText('הרשמה לקהילה')
  await expect(detail.preview().body().locator).toContainText('שלום לתלמידה ולקהילה')
  await detail.back().locator.click()
  await expect(page).toHaveTitle('אימיילים')
})

test('new members receive an immutable Hebrew registration email with RTL content', async () => {
  const now = new Date()
  const {communityNumber, studentNumber} = await createMemberFixture(
    sql(),
    now,
    'תלמידה',
    'student@example.com',
  )
  await addMember(communityNumber, studentNumber, now, sql(), undefined, registrationEmails())
  await registrationEmails().execute()
  const [email] = await listEmails({query: '', page: 0}, sql())
  expect(email.language).toBe('he')
  expect(email.subject).toBe('ברוכים הבאים לקהילת Community')
  expect(email.text).toContain('שלום תלמידה Student,')
  expect(email.html).toContain('dir="rtl"')
  expect(emailService().sentEmails[0].message.html).toBe(email.html)
})
