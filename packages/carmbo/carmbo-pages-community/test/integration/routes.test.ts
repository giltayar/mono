import {expect, test} from '@playwright/test'
import {setup} from './common/setup.ts'
import {createCommunity} from '../../src/model.ts'
import {addMember, queryMember} from '../../src/member-model.ts'
import {createStudent} from '@giltayar/carmbo-pages-student/students'

for (const [language, title, direction] of [
  ['en', 'Communities', 'ltr'],
  ['he', 'קהילות', 'rtl'],
] as const) {
  test.describe(`${language} community routes`, () => {
    const {url, sql} = setup(`${import.meta.url}/${language}`, {language})

    test('localizes the unified add form and student dialog', async ({page}) => {
      const communityNumber = await createCommunity(
        {name: 'Local community'},
        undefined,
        new Date(),
        sql(),
      )
      const studentNumber = await createStudent(
        {names: [{firstName: 'Local', lastName: 'Student'}], emails: ['local@example.com']},
        undefined,
        undefined,
        undefined,
        new Date(),
        sql(),
      )
      const addName = language === 'he' ? 'הוספת חבר' : 'Add member'
      const dialogName = language === 'he' ? 'חיפוש / יצירת תלמיד' : 'Search / create student'
      const addUrl = new URL(`/communities/${communityNumber}/members/new`, url()).href
      await page.goto(addUrl)
      const form = page.getByRole('form', {name: addName, exact: true})
      await expect(page.locator('html')).toHaveAttribute('dir', direction)
      await expect(
        form.getByRole('checkbox', {
          name: language === 'he' ? 'מפרסם' : 'Poster',
          exact: true,
        }),
      ).toBeChecked()
      await form
        .getByRole('checkbox', {
          name: language === 'he' ? 'משדר בשידור חי' : 'Live streamer',
          exact: true,
        })
        .check()
      await form.getByRole('button', {name: dialogName, exact: true}).click()
      const dialog = page.getByRole('dialog', {name: dialogName, exact: true})
      await dialog.getByRole('searchbox').fill('local@example.com')
      await dialog
        .getByRole('button', {
          name: `${language === 'he' ? 'בחירה' : 'Select'} Local Student`,
          exact: true,
        })
        .click()
      await expect(dialog).not.toBeVisible()
      await expect(page).toHaveURL(addUrl)
      await expect(
        form.getByRole('textbox', {
          name: language === 'he' ? 'תלמיד' : 'Student',
          exact: true,
        }),
      ).toHaveValue(`${studentNumber}: Local Student`)
      await form.getByRole('button', {name: addName, exact: true}).click()
      await expect(page).toHaveURL(
        new URL(`/communities/${communityNumber}/members/${studentNumber}`, url()).href,
      )
      const {member, history} = await queryMember(communityNumber, studentNumber, sql())
      expect(member).toMatchObject({
        poster: true,
        liveStreamer: true,
        moderator: false,
        userBlocker: false,
        userApprover: false,
        status: 'started-registration',
        registrationEmailSentAt: null,
      })
      expect(history).toHaveLength(1)
    })

    test('registers locale resources and serves package assets', async ({page, request}) => {
      const pageErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(error.message))
      await page.goto(new URL('/communities', url()).href)

      await expect(page).toHaveTitle(title)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      await expect(page.locator('html')).toHaveAttribute('dir', direction)
      await expect(page.getByRole('heading', {name: title})).toBeVisible()
      const activeLink = page.getByRole('navigation').getByRole('link', {name: title, exact: true})
      await expect(activeLink).toHaveClass(/active/)
      await expect(activeLink).toHaveAttribute('href', '/communities')

      const stylesheetUrl = await page
        .locator('link[href="/communities/style.css"]')
        .getAttribute('href')
      const scriptUrl = await page
        .locator('script[src="/communities/scripts.js"]')
        .getAttribute('src')
      expect(stylesheetUrl).toBe('/communities/style.css')
      expect(scriptUrl).toBe('/communities/scripts.js')

      const stylesheet = await request.get(new URL(stylesheetUrl!, url()).href)
      expect(stylesheet.status()).toBe(200)
      expect(stylesheet.headers()['content-type']).toContain('text/css')
      expect(await stylesheet.text()).toContain('.communities-view')

      const script = await request.get(new URL(scriptUrl!, url()).href)
      expect(script.status()).toBe(200)
      expect(script.headers()['content-type']).toContain('application/javascript')
      expect(await script.text()).toContain("classList.contains('discard')")
      expect(await page.evaluate(() => typeof (window as any).htmx)).toBe('object')
      expect(pageErrors).toEqual([])
    })

    test('localizes membership pages, roles, actions, and history', async ({page, request}) => {
      const memberList = page.getByRole('table', {
        name: language === 'he' ? 'חברי הקהילה' : 'Community members',
        exact: true,
      })
      const roles = page.getByRole('form', {
        name: language === 'he' ? 'תפקידים' : 'Roles',
        exact: true,
      })
      const actions = page.getByRole('form', {
        name: language === 'he' ? 'פעולות חברות' : 'Membership actions',
        exact: true,
      })
      const history = page.getByRole('list', {
        name: language === 'he' ? 'היסטוריית החברות' : 'Membership history',
        exact: true,
      })
      const state = page.getByRole('region', {
        name: language === 'he' ? 'פרטי החברות' : 'Membership details',
        exact: true,
      })
      const communityNumber = await createCommunity(
        {name: 'Local community'},
        undefined,
        new Date(),
        sql(),
      )
      const studentNumber = await createStudent(
        {
          names: [{firstName: 'Local', lastName: 'Student'}],
          emails: ['local@example.com'],
        },
        undefined,
        undefined,
        undefined,
        new Date(),
        sql(),
      )
      await addMember(communityNumber, studentNumber, new Date(), sql())
      await page.goto(new URL(`/communities/${communityNumber}`, url()).href)
      await expect(memberList).toHaveCount(0)
      await page
        .getByRole('navigation', {
          name: language === 'he' ? 'ניווט בקהילה' : 'Community navigation',
          exact: true,
        })
        .getByRole('link', {
          name: language === 'he' ? 'חברים' : 'Members',
          exact: true,
        })
        .click()
      await expect(page).toHaveURL(new URL(`/communities/${communityNumber}/members`, url()).href)
      await expect(
        page.getByRole('heading', {
          name: language === 'he' ? 'חברי הקהילה' : 'Community members',
        }),
      ).toBeVisible()
      await expect(memberList.getByRole('link', {name: 'Local Student'})).toHaveAttribute(
        'href',
        `/students/${studentNumber}`,
      )
      await memberList.getByRole('button', {name: String(studentNumber), exact: true}).click()
      await expect(page.locator('html')).toHaveAttribute('dir', direction)
      await expect(
        roles.getByRole('checkbox', {
          name: language === 'he' ? 'מאשר משתמשים' : 'User approver',
          exact: true,
        }),
      ).toBeVisible()
      await actions
        .getByRole('button', {
          name: language === 'he' ? 'סימון כרשום' : 'Mark registered',
          exact: true,
        })
        .click()
      await expect(history.getByRole('listitem')).toHaveCount(2)
      await expect(history).toContainText(language === 'he' ? 'נרשם' : 'Registered')
      await history
        .getByRole('link', {
          name: language === 'he' ? 'נוסף' : 'Added',
          exact: true,
        })
        .click()
      await expect(
        page.getByText(
          language === 'he' ? 'תמונת מצב היסטורית לקריאה בלבד' : 'Read-only membership snapshot',
        ),
      ).toBeVisible()
      await expect(
        roles.getByRole('checkbox', {name: language === 'he' ? 'מפרסם' : 'Poster', exact: true}),
      ).toBeDisabled()
      await expect(page.locator('body')).not.toContainText('members.')
      await state
        .getByRole('link', {
          name: 'Local Student',
          exact: true,
        })
        .click()
      await expect(page).toHaveURL(new URL(`/students/${studentNumber}`, url()).href)
      await expect(page.locator('input[name="names[0][firstName]"]')).toHaveValue('Local')
      const update = await request.put(new URL(`/students/${studentNumber}`, url()).href, {
        form: {
          studentNumber: String(studentNumber),
          'names[0][firstName]': 'Updated',
          'names[0][lastName]': 'Student',
          'emails[0]': 'local@example.com',
        },
      })
      expect(update.headers()['hx-redirect']).toBe(`/students/${studentNumber}`)
      await page.goto(new URL(`/communities/${communityNumber}/members`, url()).href)
      await expect(memberList.getByRole('link', {name: 'Updated Student'})).toBeVisible()
    })
  })
}

test.describe('missing communities', () => {
  const {url} = setup(`${import.meta.url}/missing`)

  test('return 404 for unknown community numbers and history ids', async ({request}) => {
    const updatePage = await request.get(new URL('/communities/999', url()).href)
    expect(updatePage.status()).toBe(404)

    const historyPage = await request.get(
      new URL('/communities/999/by-history/00000000-0000-4000-8000-000000000000', url()).href,
    )
    expect(historyPage.status()).toBe(404)

    const update = await request.put(new URL('/communities/999', url()).href, {
      form: {name: 'Nobody', description: ''},
    })
    expect(update.status()).toBe(404)

    const archive = await request.delete(
      new URL('/communities/999?delete-operation=delete', url()).href,
    )
    expect(archive.status()).toBe(404)
  })
})
