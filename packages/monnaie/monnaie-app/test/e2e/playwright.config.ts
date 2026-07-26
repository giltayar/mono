import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
  testDir: '.',
  outputDir: './.test-results',
  preserveOutput: 'failures-only',
  expect: {timeout: 5000},
  timeout: 60000,
  retries: process.env.CI ? 3 : 0,
  workers: 1,
  use: {
    ...devices['iPhone 15'],
    // the app reads `Accept-Language`, so the locale of the machine running the tests must not leak
    locale: 'en-US',
    screenshot: 'only-on-failure',
  },
})
