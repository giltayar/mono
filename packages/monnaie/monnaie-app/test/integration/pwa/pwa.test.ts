import {expect, test} from '@playwright/test'
import {version} from '../../../src/commons/version.ts'
import {createSettingsPageModel} from '../../page-model/settings/settings-page.model.ts'
import {setup} from '../common/setup.ts'
import {FIRST_USER} from '../services/fake-firebase-auth.ts'

const {url, logIn} = setup(import.meta.url)

const manifestPath = `/src/${version}/pwa/manifest.webmanifest`
const iconPath = (name: string) => `/src/${version}/pwa/icons/${name}`

test('serves install metadata and icons on every full page', async ({page, request}) => {
  await page.goto(new URL('/login', url()).href)

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', manifestPath)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#19724c')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    iconPath('apple-touch-icon.png'),
  )

  const response = await request.get(new URL(manifestPath, url()).href)
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('application/manifest+json')
  expect(await response.json()).toMatchObject({
    id: '/',
    name: 'Monnaie',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    icons: [
      {src: 'icons/icon-192.png', sizes: '192x192'},
      {src: 'icons/icon-512.png', sizes: '512x512'},
      {src: 'icons/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable'},
    ],
  })

  for (const [name, size] of [
    ['icon-192.png', 192],
    ['icon-512.png', 512],
    ['icon-maskable-512.png', 512],
    ['apple-touch-icon.png', 180],
  ] as const) {
    const iconResponse = await request.get(new URL(iconPath(name), url()).href)
    const bytes = await iconResponse.body()

    expect(iconResponse.ok()).toBe(true)
    expect(iconResponse.headers()['content-type']).toBe('image/png')
    expect(bytes.readUInt32BE(16)).toBe(size)
    expect(bytes.readUInt32BE(20)).toBe(size)
  }
})

test('does not register a service worker', async ({page}) => {
  await page.goto(new URL('/login', url()).href)

  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  const registrations = await page.evaluate(async () => navigator.serviceWorker.getRegistrations())
  expect(registrations).toHaveLength(0)
})

test('shows manual installation guidance on iOS', async ({page}) => {
  const settings = createSettingsPageModel(page)
  await logIn(page, FIRST_USER)

  await page.goto(new URL('/settings', url()).href)

  await expect(settings.installSection().locator).toBeVisible()
  await expect(settings.iosInstallInstructions().locator).toBeVisible()
  await expect(settings.installButton().locator).toBeHidden()
})

test('uses the browser installation prompt when it is offered', async ({page}) => {
  const settings = createSettingsPageModel(page)
  await logIn(page, FIRST_USER)
  await page.goto(new URL('/settings', url()).href)

  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt')
    Object.defineProperties(event, {
      prompt: {
        value: async () => {
          document.documentElement.dataset.installPrompted = 'true'
        },
      },
      userChoice: {value: Promise.resolve({outcome: 'accepted'})},
    })
    window.dispatchEvent(event)
  })

  await settings.installButton().locator.click()

  await expect(page.locator('html')).toHaveAttribute('data-install-prompted', 'true')
  await expect(settings.installSection().locator).toBeHidden()
})
