import {expect, test} from '@playwright/test'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'
import {
  createEmailListPageModel,
  createEmailPageModel,
} from '@giltayar/carmbo-pages-email/testkit/page-model/email.model'
import {setup} from './common/setup.ts'
import {seedEmail} from './common/fixture.ts'
import {queryEmail} from '../../src/model.ts'
import {
  createTemplateListPageModel,
  createTemplatePageModel,
} from '../../testkit/page-model/template.model.ts'

const {sql, url, queue, executeJobs, emailService} = setup(import.meta.url, {language: 'he'})

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
  await expect(detail.details().field('מטרה').locator).toHaveText('אימייל הרשמה')
  await expect(detail.preview().body().locator).toContainText('שלום לתלמידה ולקהילה')
  await detail.back().locator.click()
  await expect(page).toHaveTitle('אימיילים')
})

test('template list mirrors the standard layout in Hebrew', async ({page}) => {
  const list = createTemplateListPageModel(page)
  await page.setViewportSize({width: 1280, height: 800})
  await page.goto(new URL('/emails/templates', url()).href)
  await expect(list.headers().locator).toHaveText(['מספר', 'שם', 'תיאור'])
  await expect(list.activeTab().locator).toHaveText('תבניות דואר אלקטרוני')
  await expect(list.new().locator).toHaveAccessibleName('תבנית דואר חדשה')
  await expect(list.addSection().locator).toHaveCSS('left', '16px')
})

test('queued Hebrew emails are stored and sent unchanged', async () => {
  const html = '<!doctype html><html lang="he" dir="rtl"><body>שלום תלמידה</body></html>'
  const {emailNumber} = await queue({subject: 'ברוכים הבאים', html, text: 'שלום תלמידה'})
  await executeJobs()
  const email = await queryEmail(emailNumber, sql())
  expect(email?.language).toBe('he')
  expect(email?.subject).toBe('ברוכים הבאים')
  expect(emailService().sentEmails[0].message).toMatchObject({
    subject: 'ברוכים הבאים',
    html,
    text: 'שלום תלמידה',
  })
})

test('template detail cards and action groups mirror in Hebrew and fit mobile screens', async ({
  page,
}) => {
  const template = createTemplatePageModel(page)
  await page.setViewportSize({width: 1280, height: 800})
  await page.goto(new URL('/emails/templates/new', url()).href)
  await expect(template.action('שמירת תבנית').locator).toBeEnabled()
  await expect(template.toolbar().locator).toHaveAttribute('dir', 'rtl')
  await template.action('מודגש').locator.focus()
  await template.action('מודגש').locator.press('ArrowLeft')
  await expect(template.action('נטוי').locator).toBeFocused()
  await template.action('סגנון טקסט').locator.click()
  await expect(template.menuItem('כותרת 2').locator).toBeVisible()
  await template.menuItem('כותרת 2').locator.press('Escape')
  await expect(template.inspector().locator).toHaveAccessibleName('עיצוב')
  await expect(template.inspector().locator).toHaveCSS('direction', 'rtl')
  await expect(template.inspector().mode().locator).toHaveText('מכל התוכן')
  await expect(template.inspector().sections().locator).toHaveText([
    'ריווח פנימי',
    'שוליים',
    'מסגרת',
    'רקע',
  ])
  const inspector = (await template.inspector().locator.boundingBox())!
  const content = (await template.hebrewContent().locator.boundingBox())!
  expect(inspector.x + inspector.width).toBeLessThan(content.x)
  expect(inspector.y).toBeCloseTo(content.y, 0)
  const fields = (await template.fields().locator.boundingBox())!
  const heading = (await template.heading().locator.boundingBox())!
  const actions = (await template.actions().locator.boundingBox())!
  expect(fields.x).toBeGreaterThan(600)
  expect(heading.x).toBeCloseTo(fields.x, 0)
  expect(actions.x).toBeCloseTo(fields.x, 0)
  expect(actions.y + actions.height).toBeLessThan(fields.y)
  await expect(template.floatingLabels().locator.first()).toHaveCSS('text-align', 'start')
  await page.setViewportSize({width: 390, height: 844})
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(template.action('שמירת תבנית').locator).toBeInViewport()
  await expect(template.inspector().field('ריווח שמאלי').locator).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('creates a Hebrew template with localized controls and mixed-direction content', async ({
  page,
}) => {
  test.setTimeout(30000)
  const template = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/new', url()).href)
  await expect(template.languagePage().locator).toHaveAttribute('dir', 'rtl')
  await template.hebrewField('שם').locator.fill('תבנית ברכה')
  await template.hebrewField('תבנית נושא').locator.fill('שלום {{name}}')
  await template.hebrewContent().locator.fill('שלום {{name}} Hello')
  await expect(template.hebrewSamples().locator).toContainText('name')
  await template.contentBlocks().locator.first().click()
  await expect(template.inspector().mode().locator).toHaveText('פסקה')
  await expect(template.inspector().sections().locator).toHaveText([
    'טקסט',
    'ריווח פנימי',
    'שוליים',
    'מסגרת',
    'רקע',
  ])
  await template.inspector().field('ריווח ימני').locator.fill('12')
  await expect(template.contentBlocks().locator.first()).toHaveCSS('padding-right', '12px')
  await template.contentBlocks().locator.first().selectText()
  await expect(template.inspector().mode().locator).toHaveText('טקסט נבחר')
  await expect(template.inspector().sections().locator).toHaveText(['טקסט', 'רקע'])
  await expect(template.inspector().labels().locator).toHaveText(['צבע', 'גודל', 'צבע'])
  await template.inspector().field('צבע טקסט').locator.fill('#663399')
  await expect(template.editorSpans().locator).toHaveCSS('color', 'rgb(102, 51, 153)')
  await template.action('מימין לשמאל').locator.click()
  await template.action('שמירת תבנית').locator.click()
  await expect(page).toHaveURL(/\/emails\/templates\/1$/)
  await expect(template.hebrewContent().locator).toContainText('שלום {{name}} Hello')
  await expect(template.action('משמאל לימין').locator).toBeVisible()
  await template.action('הצגת קוד HTML').locator.click()
  await expect(template.dialog().locator).toHaveAccessibleName('הצגת קוד HTML')
  await expect(template.rawHtml().locator).toHaveAttribute('dir', 'ltr')
  await expect(template.rawHtml().locator).toHaveValue(/שלום \{\{name\}\} Hello/)
  await template.action('סגירה').locator.click()
  await template.action('תצוגה מקדימה').locator.click()
  await expect(template.dialog().locator).toHaveAccessibleName('תצוגה מקדימה')
  await expect(template.dialog().locator).toHaveCSS('direction', 'rtl')
  await template.action('סגירה').locator.click()
  await template.action('שליחת הודעת דואר לניסיון').locator.click()
  await expect(template.dialog().locator).toHaveAccessibleName('שליחת הודעת דואר לניסיון')
  await expect(template.hebrewField('כתובת לשליחת ניסיון').locator).toBeFocused()
  await template.action('ביטול').locator.click()
  await expect(template.dialog().locator).toHaveCount(0)
})
