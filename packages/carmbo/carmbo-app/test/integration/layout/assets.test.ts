import {test, expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
import {layoutScriptRoot, layoutStyleRoot} from '@giltayar/carmbo-common/layout/assets'
import packageJson from '../../../package.json' with {type: 'json'}
import enStudent from '../../../src/domain/student/locale/en.json' with {type: 'json'}
import heStudent from '../../../src/domain/student/locale/he.json' with {type: 'json'}
import {createAllPagesPageModel} from '../../page-model/common/all-pages.model.ts'
import {setup} from '../common/setup.ts'

for (const [brand, language, direction, logo, translations] of [
  ['carmel', 'en', 'ltr', 'logo.png', enStudent],
  ['liraz', 'he', 'rtl', 'logo.svg', heStudent],
] as const) {
  test.describe(`${brand} shared assets`, () => {
    const {url} = setup(`${import.meta.url}/${brand}`, {uiConfiguration: brand, language})

    test('preserves rendered URLs and serves installed assets alongside app assets', async ({
      page,
      request,
    }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      const model = createAllPagesPageModel(page)
      const version = packageJson.version
      const srcPrefix = `/src/${version}/`
      const distPrefix = `/dist/${version}/`
      const bootstrapCss = `bootstrap.${direction === 'rtl' ? 'rtl.' : ''}min.css`

      await page.goto(new URL('/students', url()).href)
      await expect(model.documentElement().locator).toHaveAttribute('lang', language)
      await expect(model.documentElement().locator).toHaveAttribute('dir', direction)
      await expect(page).toHaveTitle(translations.list.students)

      const renderedAssets = await model
        .assets()
        .locator.evaluateAll((elements) =>
          elements.map(
            (element) =>
              element.getAttribute('href') ??
              element.getAttribute('src') ??
              element.getAttribute('data'),
          ),
        )
      expect(renderedAssets).toEqual(
        expect.arrayContaining([
          `${distPrefix}${bootstrapCss}`,
          `${distPrefix}htmx.min.js`,
          `${distPrefix}bootstrap.bundle.min.js`,
          `${srcPrefix}layout/style/style.css`,
          `${srcPrefix}layout/js/scripts.js`,
          `${srcPrefix}layout/style/configurations/${brand}/${logo}`,
          `${srcPrefix}domain/student/view/js/scripts.js`,
          `${srcPrefix}domain/student/view/style/style.css`,
        ]),
      )

      for (const [prefix, root, files] of [
        [`${srcPrefix}layout/js/`, layoutScriptRoot, ['scripts.js']],
        [
          `${srcPrefix}layout/style/`,
          layoutStyleRoot,
          [
            'style.css',
            'link.svg',
            'external-link.svg',
            'plus-circle.svg',
            'minus-circle.svg',
            'configurations/carmel/logo.png',
            'configurations/liraz/logo.svg',
          ],
        ],
        [
          `${srcPrefix}domain/`,
          new URL('../../../src/domain/', import.meta.url),
          ['student/view/js/scripts.js', 'student/view/style/style.css'],
        ],
        [
          distPrefix,
          new URL('../../../dist/', import.meta.url),
          ['bootstrap.min.css', 'bootstrap.rtl.min.css', 'htmx.min.js', 'bootstrap.bundle.min.js'],
        ],
      ] as const) {
        for (const file of files) {
          const response = await request.get(new URL(prefix + file, url()).href)
          expect(response.status(), file).toBe(200)
          expect(response.headers()['cache-control'], file).toContain('max-age=31536000, immutable')
          const contentType = file.endsWith('.css')
            ? 'text/css'
            : file.endsWith('.js')
              ? 'application/javascript'
              : file.endsWith('.svg')
                ? 'image/svg+xml'
                : 'image/png'
          expect(response.headers()['content-type'], file).toContain(contentType)
          expect(await response.body(), file).toEqual(await readFile(new URL(file, root)))
        }
      }

      for (const path of [
        'layout/main-view.js',
        'layout/assets.js',
        'layout/locale/en.json',
        'layout/js/scripts.d.ts',
        'layout/js/scripts.js.map',
        'domain/student/route.ts',
        'sql/migration.js',
      ]) {
        const response = await request.get(new URL(srcPrefix + path, url()).href)
        expect(response.status(), path).toBe(404)
      }
      expect(errors).toEqual([])
    })
  })
}
