import {expect, test} from '@playwright/test'
import {version} from '../../../src/commons/version.ts'
import {setup} from '../common/setup.ts'

const {url} = setup(import.meta.url)

for (const assetPath of [`/src/${version}/layout/style/style.css`, `/dist/${version}/chart.js`]) {
  test(`does not cache ${assetPath} immutably outside production`, async ({request}) => {
    const response = await request.get(new URL(assetPath, url()).href)

    expect(response.ok()).toBe(true)
    expect(response.headers()['cache-control']).toBe('public, max-age=0')
  })
}
