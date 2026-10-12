import {expect, test} from '@playwright/test'
import {setup} from './common/setup.ts'

for (const [language, title, direction] of [
  ['en', 'Communities', 'ltr'],
  ['he', 'קהילות', 'rtl'],
] as const) {
  test.describe(`${language} community routes`, () => {
    const {url} = setup(`${import.meta.url}/${language}`, {language})

    test('registers locale resources and serves package assets', async ({page, request}) => {
      const pageErrors: string[] = []
      page.on('pageerror', (error) => pageErrors.push(error.message))
      await page.goto(new URL('/communities', url()).href)

      await expect(page).toHaveTitle(title)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      await expect(page.locator('html')).toHaveAttribute('dir', direction)
      await expect(page.getByRole('heading', {name: title})).toBeVisible()
      await expect(page.getByRole('navigation').locator('a.nav-link.active')).toHaveAttribute(
        'href',
        '/communities',
      )

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
