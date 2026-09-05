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
  await expect(page.getByRole('link', {name: 'Add an expense'})).toBeVisible()
})

test('switches the language, and remembers it for the next visit', async ({page}) => {
  await page.goto(url().href)
  await page.getByRole('link', {name: 'Settings'}).click()

  await page.getByLabel('Language').selectOption('he')

  await expect(page.locator('html')).toHaveAttribute('lang', 'he')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', {name: 'מוניי'})).toBeVisible()
  await expect(page.getByRole('link', {name: 'הוספת הוצאה'})).toBeVisible()

  await page.goto(url().href)

  await expect(page.locator('html')).toHaveAttribute('lang', 'he')
})

test('remembers the language on the account, not only in the browser', async ({page}) => {
  await page.goto(url().href)
  await page.getByRole('link', {name: 'Settings'}).click()

  await page.getByLabel('Language').selectOption('he')

  await expect(page.locator('html')).toHaveAttribute('lang', 'he')

  // a different browser, which has never seen the `lang` cookie, but the same account
  await page.context().clearCookies()
  await logIn(page, FIRST_USER)
  await page.goto(url().href)

  await expect(page.locator('html')).toHaveAttribute('lang', 'he')
  await expect(page.getByRole('link', {name: 'הוספת הוצאה'})).toBeVisible()
})

test.describe('with a Hebrew browser', () => {
  test.use({locale: 'he-IL'})

  test('shows the app in Hebrew, right to left', async ({page}) => {
    await page.goto(url().href)

    await expect(page.locator('html')).toHaveAttribute('lang', 'he')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.getByRole('link', {name: 'הוספת הוצאה'})).toBeVisible()
    await expect(page.getByRole('region', {name: 'סיכום'})).toBeVisible()
    await expect(page.getByRole('heading', {name: 'סיכום: היום'})).toBeVisible()
    await expect(page.getByRole('region', {name: 'החודש'})).toBeVisible()
  })

  test('keeps the time arrows in backward-then-forward order', async ({page}) => {
    await page.goto(url().href)

    const navigation = page.locator('.period-navigation').first()
    const backwardBox = await navigation.getByRole('link').boundingBox()
    const forwardBox = await navigation.locator('span').boundingBox()

    expect(backwardBox).not.toBeNull()
    expect(forwardBox).not.toBeNull()
    expect(backwardBox!.x).toBeLessThan(forwardBox!.x)
  })

  test('shows the validation errors in Hebrew', async ({page}) => {
    // the empty category is what the browser itself would refuse, so the form is posted directly —
    // and a direct request carries none of the context's locale, so it asks for Hebrew itself
    const response = await page.request.post(new URL('/expenses', url()).href, {
      form: {
        description: 'קפה',
        amount: '12.50',
        categoryId: '',
        expenseType: 'day-to-day',
      },
      headers: {'accept-language': 'he-IL'},
    })

    expect(await response.text()).toContain('נא לבחור קטגוריה')
  })

  test('prefers the language of the cookie over the language of the browser', async ({page}) => {
    await page.goto(new URL('/settings', url()).href)

    await page.getByLabel('שפה').selectOption('en')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.getByRole('link', {name: 'Add an expense'})).toBeVisible()
  })
})
