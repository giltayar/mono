import {expect, test} from '@playwright/test'
import {setup} from './common/setup.ts'

for (const [language, title, direction] of [
  ['en', 'Students', 'ltr'],
  ['he', 'תלמידות', 'rtl'],
] as const) {
  test.describe(`${language} student routes`, () => {
    const {url} = setup(`${import.meta.url}/${language}`, {language})

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
