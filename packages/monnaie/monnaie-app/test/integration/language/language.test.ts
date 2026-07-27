import {expect, test} from '@playwright/test'
import {setup} from '../common/setup.ts'
import {FIRST_USER} from '../services/fake-firebase-auth.ts'

const {url, logIn} = setup(import.meta.url)

// The only tests that run in a language other than English, and therefore the only ones that use
// locators directly instead of `test/page-model/**`: the page models are English-only on purpose,
// and teaching them about languages would complicate every other test for the sake of this file.

test.beforeEach(async ({page}) => {
  await logIn(page, FIRST_USER)
})

test('shows the app in the default language when the browser asks for nothing we support', async ({
  page,
}) => {
  await page.goto(url().href)

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByRole('button', {name: 'Calculate'})).toBeVisible()
})

test('switches the language, and remembers it for the next visit', async ({page}) => {
  await page.goto(url().href)

  await page.getByLabel('Language').selectOption('he')
  await page.getByRole('button', {name: 'Switch'}).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'he')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('button', {name: 'חשב'})).toBeVisible()

  await page.goto(url().href)

  await expect(page.locator('html')).toHaveAttribute('lang', 'he')
})

test('remembers the language on the account, not only in the browser', async ({page}) => {
  await page.goto(url().href)

  await page.getByLabel('Language').selectOption('he')
  await page.getByRole('button', {name: 'Switch'}).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'he')

  // a different browser, which has never seen the `lang` cookie, but the same account
  await page.context().clearCookies()
  await logIn(page, FIRST_USER)
  await page.goto(url().href)

  await expect(page.locator('html')).toHaveAttribute('lang', 'he')
  await expect(page.getByRole('button', {name: 'חשב'})).toBeVisible()
})

test.describe('with a Hebrew browser', () => {
  test.use({locale: 'he-IL'})

  test('shows the app in Hebrew, right to left', async ({page}) => {
    await page.goto(url().href)

    await expect(page.locator('html')).toHaveAttribute('lang', 'he')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('button', {name: 'חשב'})).toBeVisible()
    await expect(page.getByRole('region', {name: 'היסטוריה'})).toBeVisible()
  })

  test('shows the calculation errors in Hebrew', async ({page}) => {
    await page.goto(url().href)

    await page.getByRole('textbox', {name: 'חישוב'}).fill('1 +* 3')
    await page.getByRole('button', {name: 'חשב'}).click()

    await expect(page.getByRole('status')).toHaveText('החישוב אינו תקין')
  })

  test('prefers the language of the cookie over the language of the browser', async ({page}) => {
    await page.goto(url().href)

    await page.getByLabel('שפה').selectOption('en')
    await page.getByRole('button', {name: 'החלפה'}).click()

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.getByRole('button', {name: 'Calculate'})).toBeVisible()
  })
})
