import {expect, test} from '@playwright/test'
import {setup} from './common/setup.ts'
import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {finalHtml} from '@giltayar/carmbo-commons/commons/controller-result'
import {MainLayout} from '@giltayar/carmbo-commons/layout/main-view'
import {
  StudentPickerButton,
  StudentPickerDialogContainer,
} from '@giltayar/carmbo-pages-student/student-picker'
import {createStudent, deleteStudent, queryStudentByNumber} from '../../src/model.ts'
import {routes} from '../../src/route.ts'

for (const [language, title, direction] of [
  ['en', 'Students', 'ltr'],
  ['he', 'תלמידות', 'rtl'],
] as const) {
  test.describe(`${language} student routes`, () => {
    const {url, sql, TEST_hooks, smooveIntegration, ravmesserIntegration} = setup(
      `${import.meta.url}/${language}`,
      {
        language,
        registerRoutes: (app, options) => {
          app.register(routes, {prefix: '/nested/students', ...options})
          app.get('/nested-picker-host', async (_request, reply) =>
            reply.type('text/html').send(
              finalHtml(html`
              <${MainLayout} title="Nested picker host" activeNavItem="students">
                <form aria-label="Nested form">
                  <label for="nested-student">Nested student</label>
                  <input id="nested-student" name="studentNumber" />
                  <${StudentPickerButton} targetFieldId="nested-student" basePath="/nested/students" />
                </form>
                <${StudentPickerDialogContainer} targetFieldId="nested-student" basePath="/nested/students" />
              </${MainLayout}>
            `),
            ),
          )
          app.get('/picker-host', async (_request, reply) =>
            reply.type('text/html').send(
              finalHtml(html`
            <${MainLayout} title="Picker host" activeNavItem="students">
              <form aria-label="Sale form">
                <label for="sale-student">Sale student</label>
                <input id="sale-student" name="studentNumber" />
                <${StudentPickerButton} targetFieldId="sale-student" />
              </form>
              <${StudentPickerDialogContainer} targetFieldId="sale-student" />
              <form aria-label="Member form">
                <label for="member-student">Member student</label>
                <input id="member-student" name="studentNumber"
                  onchange="document.getElementById('selected-email').value = event.detail?.email ?? ''" />
                <${StudentPickerButton} targetFieldId="member-student" />
                <label for="selected-email">Selected email</label>
                <input id="selected-email" readonly />
                <label><input type="checkbox" checked />Poster</label>
                <label>Unrelated value<input value="Keep me" /></label>
              </form>
              <${StudentPickerDialogContainer} targetFieldId="member-student" />
            </${MainLayout}>
          `),
            ),
          )
        },
      },
    )
    const names =
      language === 'he'
        ? {
            dialog: 'חיפוש / יצירת תלמיד',
            select: 'בחירה',
            cancel: 'ביטול',
            create: 'יצירת תלמיד',
            firstName: 'שם פרטי',
            lastName: 'שם משפחה',
            email: 'דוא״ל',
            phone: 'טלפון (רשות)',
            submit: 'יצירה ובחירה',
          }
        : {
            dialog: 'Search / create student',
            select: 'Select',
            cancel: 'Cancel',
            create: 'Create a student',
            firstName: 'First name',
            lastName: 'Last name',
            email: 'Email',
            phone: 'Phone (optional)',
            submit: 'Create and select',
          }

    test('shared picker selects into the right form and leaves other fields unchanged', async ({
      page,
    }) => {
      const studentNumber = await createStudent(
        {
          names: [{firstName: 'יעל', lastName: 'כהן'}],
          emails: ['yael@example.com'],
          phones: ['0501234567'],
        },
        undefined,
        undefined,
        undefined,
        new Date(),
        sql(),
      )
      await page.goto(new URL('/picker-host', url()).href)
      const sale = page.getByRole('form', {name: 'Sale form', exact: true})
      const member = page.getByRole('form', {name: 'Member form', exact: true})
      await member.getByRole('checkbox', {name: 'Poster', exact: true}).uncheck()
      await member.getByRole('button', {name: names.dialog, exact: true}).click()
      const dialog = page.getByRole('dialog', {name: names.dialog, exact: true})
      await expect(dialog.getByRole('searchbox')).toBeFocused()
      await dialog.getByRole('button', {name: names.cancel, exact: true}).click()
      await expect(dialog).not.toBeVisible()
      await member.getByRole('button', {name: names.dialog, exact: true}).click()
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
      await member.getByRole('button', {name: names.dialog, exact: true}).click()
      await dialog.getByRole('searchbox').fill('yael@example.com')
      await dialog.getByRole('button', {name: `${names.select} יעל כהן`, exact: true}).click()
      await expect(dialog).not.toBeVisible()
      await expect(member.getByRole('textbox', {name: 'Member student', exact: true})).toHaveValue(
        `${studentNumber}: יעל כהן`,
      )
      await expect(member.getByRole('textbox', {name: 'Selected email', exact: true})).toHaveValue(
        'yael@example.com',
      )
      await expect(member.getByRole('textbox', {name: 'Member student', exact: true})).toBeFocused()
      await expect(member.getByRole('checkbox', {name: 'Poster', exact: true})).not.toBeChecked()
      await expect(member.getByRole('textbox', {name: 'Unrelated value', exact: true})).toHaveValue(
        'Keep me',
      )
      await expect(sale.getByRole('textbox', {name: 'Sale student', exact: true})).toHaveValue('')
      await sale.getByRole('button', {name: names.dialog, exact: true}).click()
      await dialog.getByRole('searchbox').fill('0501234567')
      await dialog.getByRole('button', {name: `${names.select} יעל כהן`, exact: true}).click()
      await expect(sale.getByRole('textbox', {name: 'Sale student', exact: true})).toHaveValue(
        `${studentNumber}: יעל כהן`,
      )
    })

    test('shared picker creates and selects with normalized data and integrations', async ({
      page,
    }) => {
      await page.goto(new URL('/picker-host', url()).href)
      const member = page.getByRole('form', {name: 'Member form', exact: true})
      await member.getByRole('button', {name: names.dialog, exact: true}).click()
      const dialog = page.getByRole('dialog', {name: names.dialog, exact: true})
      await dialog.getByText(names.create, {exact: true}).click()
      await dialog.getByRole('textbox', {name: names.firstName, exact: true}).fill(' New ')
      await dialog.getByRole('textbox', {name: names.lastName, exact: true}).fill(' Student ')
      await dialog.getByRole('textbox', {name: names.email, exact: true}).fill('NEW@EXAMPLE.COM')
      await dialog.getByRole('textbox', {name: names.phone, exact: true}).fill('+972501234567')
      await dialog.getByRole('button', {name: names.submit, exact: true}).click()
      await expect(dialog).not.toBeVisible()
      const input = member.getByRole('textbox', {name: 'Member student', exact: true})
      const studentNumber = Number((await input.inputValue()).split(':')[0])
      await expect(input).toHaveValue(`${studentNumber}: New Student`)
      await expect(member.getByRole('textbox', {name: 'Selected email', exact: true})).toHaveValue(
        'new@example.com',
      )
      const found = await queryStudentByNumber(studentNumber, sql())
      expect(found?.student).toMatchObject({
        names: [{firstName: 'New', lastName: 'Student'}],
        emails: ['new@example.com'],
        phones: ['0501234567'],
      })
      expect(found?.history).toHaveLength(1)
      expect(
        await smooveIntegration().fetchSmooveContact('new@example.com', {by: 'email'}),
      ).toMatchObject({email: 'new@example.com'})
      expect(
        await ravmesserIntegration().fetchRavmesserContact('new@example.com', {by: 'email'}),
      ).toMatchObject({email: 'new@example.com'})
    })

    test('shared picker keeps errors and typed values in the dialog', async ({page, request}) => {
      await createStudent(
        {names: [{firstName: 'Existing', lastName: 'Student'}], emails: ['exists@example.com']},
        undefined,
        undefined,
        undefined,
        new Date(),
        sql(),
      )
      await page.goto(new URL('/picker-host', url()).href)
      const member = page.getByRole('form', {name: 'Member form', exact: true})
      await member.getByRole('button', {name: names.dialog, exact: true}).click()
      const dialog = page.getByRole('dialog', {name: names.dialog, exact: true})
      await dialog.getByText(names.create, {exact: true}).click()
      await dialog.getByRole('textbox', {name: names.firstName, exact: true}).fill('Typed')
      await dialog.getByRole('textbox', {name: names.lastName, exact: true}).fill('Student')
      await dialog.getByRole('textbox', {name: names.email, exact: true}).fill('exists@example.com')
      await dialog.getByRole('button', {name: names.submit, exact: true}).click()
      await expect(dialog.getByRole('alert')).toBeVisible()
      await expect(dialog.getByRole('textbox', {name: names.firstName, exact: true})).toHaveValue(
        'Typed',
      )
      await expect(member.getByRole('textbox', {name: 'Member student', exact: true})).toHaveValue(
        '',
      )
      TEST_hooks.createStudent = () => {
        throw new Error('Picker creation failed')
      }
      await dialog.getByRole('textbox', {name: names.email, exact: true}).fill('new@example.com')
      await dialog.getByRole('button', {name: names.submit, exact: true}).click()
      await expect(dialog.getByRole('alert')).toContainText('Picker creation failed')
      await expect(dialog.getByRole('textbox', {name: names.email, exact: true})).toHaveValue(
        'new@example.com',
      )
      expect((await sql()`SELECT * FROM student`).length).toBe(1)
      const invalid = await request.post(
        new URL('/students/picker/create?targetFieldId=member-student', url()).href,
        {
          form: {firstName: ' ', lastName: 'Student', email: 'invalid'},
        },
      )
      expect(invalid.headers()['hx-trigger']).toBeUndefined()
      expect(await invalid.text()).toContain(
        language === 'he' ? 'יש לבדוק את פרטי התלמיד' : 'Please check the student details',
      )
    })

    test('shared picker rejects archived students and unsafe target IDs', async ({request}) => {
      const studentNumber = await createStudent(
        {names: [{firstName: 'Archived', lastName: 'Student'}], emails: ['archived@example.com']},
        undefined,
        undefined,
        undefined,
        new Date(),
        sql(),
      )
      await deleteStudent(
        studentNumber,
        undefined,
        'delete',
        undefined,
        undefined,
        new Date(),
        sql(),
      )
      const search = await request.get(
        new URL('/students/picker/search?targetFieldId=member-student&q=archived', url()).href,
      )
      expect(await search.text()).toContain(
        language === 'he' ? 'לא נמצאו תלמידים' : 'No students found',
      )
      const selection = await request.post(
        new URL('/students/picker/select?targetFieldId=member-student', url()).href,
        {form: {studentNumber}},
      )
      expect(selection.headers()['hx-trigger']).toBeUndefined()
      expect(selection.headers()['hx-retarget']).toBe('#member-student-student-picker-container')
      expect(await selection.text()).toContain(language === 'he' ? 'הועבר לארכיון' : 'is archived')
      expect(
        (
          await request.get(new URL('/students/picker?targetFieldId=bad%22id', url()).href)
        ).status(),
      ).toBe(400)
      expect(
        (
          await request.post(
            new URL('/students/picker/select?targetFieldId=member-student', url()).href,
            {form: {studentNumber: 999}},
          )
        ).headers()['hx-trigger'],
      ).toBeUndefined()
    })

    test('shared picker bounds search results and handles empty queries', async ({request}) => {
      for (let index = 0; index < 22; index++) {
        await createStudent(
          {
            names: [{firstName: 'Bounded', lastName: `Student ${index}`}],
            emails: [`bounded-${index}@example.com`],
          },
          undefined,
          undefined,
          undefined,
          new Date(),
          sql(),
        )
      }
      const search = await request.get(
        new URL('/students/picker/search?targetFieldId=member-student&q=Bounded', url()).href,
      )
      const results = await search.text()
      expect(results.match(/hx-post=/g)).toHaveLength(20)
      expect(results).toContain('Bounded Student 21')
      expect(results).not.toContain('Bounded Student 0<')
      const empty = await request.get(
        new URL('/students/picker/search?targetFieldId=member-student&q=', url()).href,
      )
      expect(await empty.text()).toContain(
        language === 'he' ? 'לא נמצאו תלמידים' : 'No students found',
      )
      const invalid = await request.post(
        new URL('/students/picker/select?targetFieldId=member-student', url()).href,
        {form: {studentNumber: 'invalid'}},
      )
      expect(invalid.status()).toBe(400)
    })

    test('shared picker supports nested mounting and mobile dialogs', async ({page}) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const studentNumber = await createStudent(
        {
          names: [{firstName: 'Nested', lastName: 'Student'}],
          emails: ['nested@example.com'],
        },
        undefined,
        undefined,
        undefined,
        new Date(),
        sql(),
      )
      await page.setViewportSize({width: 375, height: 812})
      await page.goto(new URL('/nested-picker-host', url()).href)
      await page.getByRole('button', {name: names.dialog, exact: true}).click()
      const dialog = page.getByRole('dialog', {name: names.dialog, exact: true})
      await expect(dialog).toBeVisible()
      const bounds = await dialog.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.width).toBeLessThanOrEqual(343)
      expect(bounds!.height).toBeLessThanOrEqual(780)
      await dialog.getByRole('searchbox').fill('Nested')
      await dialog
        .getByRole('button', {name: `${names.select} Nested Student`, exact: true})
        .click()
      await expect(page.getByRole('textbox', {name: 'Nested student', exact: true})).toHaveValue(
        `${studentNumber}: Nested Student`,
      )
      expect(errors).toEqual([])
    })

    test('registers locale resources and serves package assets', async ({page, request}) => {
      const pageErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(error.message))
      await page.goto(new URL('/students', url()).href)

      await expect(page).toHaveTitle(title)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      await expect(page.locator('html')).toHaveAttribute('dir', direction)

      const stylesheetUrl = await page
        .locator('link[href="/students/style.css"]')
        .getAttribute('href')
      const scriptUrl = await page.locator('script[src="/students/scripts.js"]').getAttribute('src')
      expect(stylesheetUrl).toBe('/students/style.css')
      expect(scriptUrl).toBe('/students/scripts.js')

      const stylesheet = await request.get(new URL(stylesheetUrl!, url()).href)
      expect(stylesheet.status()).toBe(200)
      expect(stylesheet.headers()['content-type']).toContain('text/css')
      expect(await stylesheet.text()).toContain('.students-view')

      const script = await request.get(new URL(scriptUrl!, url()).href)
      expect(script.status()).toBe(200)
      expect(script.headers()['content-type']).toContain('application/javascript')
      expect(await script.text()).toContain("document.addEventListener('htmx:configRequest'")
      expect(await page.evaluate(() => typeof (window as any).htmx)).toBe('object')
      expect(pageErrors).toEqual([])
    })
  })
}
