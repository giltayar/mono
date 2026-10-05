import {expect, test} from '@playwright/test'
import {setup} from './common/setup.ts'

for (const [language, title, direction] of [
  ['en', 'Products', 'ltr'],
  ['he', 'מוצרים', 'rtl'],
] as const) {
  test.describe(`${language} sale routes`, () => {
    const {url} = setup(`${import.meta.url}/${language}`, {
      language,
      uiConfiguration: language === 'he' ? 'liraz' : 'carmel',
    })

    test('registers locale resources and serves package assets', async ({page, request}) => {
      await page.goto(new URL('/products', url()).href)

      await expect(page).toHaveTitle(title)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      await expect(page.locator('html')).toHaveAttribute('dir', direction)

      const stylesheetUrl = '/sale-assets/product/view/style/style.css'
      const stylesheet = await request.get(new URL(stylesheetUrl, url()).href)
      expect(stylesheet.status()).toBe(200)
      expect(stylesheet.headers()['content-type']).toContain('text/css')
      expect(await stylesheet.text()).toContain('.products-view')

      const scriptUrl = '/sale-assets/product/view/js/scripts.js'
      const script = await request.get(new URL(scriptUrl, url()).href)
      expect(script.status()).toBe(200)
      expect(script.headers()['content-type']).toContain('application/javascript')
      expect(await script.text()).toContain("document.addEventListener('htmx:configRequest'")
    })
  })
}
